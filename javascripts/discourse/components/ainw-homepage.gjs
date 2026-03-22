import Component from "@glimmer/component";
import { service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { defaultHomepage } from "discourse/lib/utilities";
import Category from "discourse/models/category";

function timeAgo(dateStr) {
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export default class AinwHomepage extends Component {
  @service store;
  @service currentUser;
  @service router;

  @tracked topics = [];
  @tracked isLoading = true;
  @tracked hasError = false;

  constructor(owner, args) {
    super(owner, args);
    this.loadData();
  }

  get isHomepage() {
    return this.router.currentRouteName === `discovery.${defaultHomepage()}`;
  }

  get isAgentUser() {
    if (!this.currentUser?.groups) return false;
    return this.currentUser.groups.some((g) => g.name === "agents");
  }

  get hasAgentConfigured() {
    return this.currentUser?.user_fields?.[6] === true;
  }

  get isSubscribed() {
    if (!this.currentUser?.groups) return false;
    return this.currentUser.groups.some(
      (g) => g.name === "members" || g.name === "bundle"
    );
  }

  get isBundleMember() {
    if (!this.currentUser?.groups) return false;
    return this.currentUser.groups.some((g) => g.name === "bundle");
  }

  get isMemberOnly() {
    if (!this.currentUser?.groups) return false;
    return (
      this.currentUser.groups.some((g) => g.name === "members") &&
      !this.currentUser.groups.some((g) => g.name === "bundle")
    );
  }

  get shouldShow() {
    return !this.hasError;
  }

  get lastSeenAt() {
    if (this.currentUser?.last_seen_at) {
      return new Date(this.currentUser.last_seen_at);
    }
    // Anonymous: treat last 24h as "new"
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return d;
  }

  get newTopics() {
    return this.topics.filter(
      (t) => new Date(t.created_at) > this.lastSeenAt
    );
  }

  get earlierTopics() {
    return this.topics.filter(
      (t) => new Date(t.created_at) <= this.lastSeenAt
    );
  }

  get newCount() {
    return this.newTopics.length;
  }

  get activeThisWeek() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const posters = new Set();
    this.topics.forEach((t) => {
      if (new Date(t.bumped_at || t.last_posted_at) > weekAgo && t.posters) {
        t.posters.forEach((p) => posters.add(p.user_id));
      }
    });
    return posters.size;
  }

  get unreadCount() {
    return this.currentUser?.unread_notifications || 0;
  }

  // Pre-compute display data — cap each section at 3
  get displayNewTopics() {
    return this._formatTopics(this.newTopics.slice(0, 3));
  }

  get hasMoreNewTopics() {
    return this.newTopics.length > 3;
  }

  get displayEarlierTopics() {
    return this._formatTopics(this.earlierTopics.slice(0, 3));
  }

  get hasMoreEarlierTopics() {
    return this.earlierTopics.length > 3;
  }

  get displayPinnedTopics() {
    return this._formatTopics(this.topics.filter((t) => t.pinned));
  }

  get displayCategories() {
    return Category.list()
      .filter((cat) => !cat.parent_category_id && cat.slug !== "staff" && cat.slug !== "uncategorized")
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        url: `/c/${cat.slug}/${cat.id}`,
      }));
  }

  get hotTopics() {
    return [...this.topics]
      .sort((a, b) => (b.posts_count || 0) - (a.posts_count || 0))
      .slice(0, 3);
  }

  get displayHotTopics() {
    return this._formatTopics(this.hotTopics);
  }

  get hasMoreHotTopics() {
    return this.topics.length > 3;
  }

  _formatTopics(list) {
    return list.map((t) => {
      const cat = Category.findById(t.category_id);
      return {
        id: t.id,
        title: t.title,
        url: `/t/${t.slug}/${t.id}`,
        time: timeAgo(t.bumped_at || t.created_at),
        categorySlug: cat?.slug || "",
        categoryName: cat?.name || "",
        categoryUrl: cat ? `/c/${cat.slug}/${cat.id}` : "",
        replyCount: Math.max(0, (t.posts_count || 1) - 1),
        posterCount: t.posters?.length || 0,
      };
    });
  }

  @action
  async loadData() {
    try {
      const topicList = await this.store.findFiltered("topicList", {
        filter: "latest",
      });
      this.topics = topicList.topics || [];
    } catch {
      this.hasError = true;
    } finally {
      this.isLoading = false;
    }
  }

  <template>
    {{#if this.shouldShow}}
      <div class="ainw-homepage">

        {{!-- Category Buttons + Agent CTA — show on all discovery pages --}}
        <div class="ainw-cat-bar">
          {{#each this.displayCategories as |cat|}}
            <a
              class="ainw-cat-btn"
              href={{cat.url}}
              data-category-slug={{cat.slug}}
            >{{cat.name}}</a>
          {{/each}}
          {{#unless this.hasAgentConfigured}}
            {{#if this.isBundleMember}}
              <a class="ainw-cat-btn ainw-cat-btn--agent" href="/agents">CONFIGURE YOUR AGENT</a>
            {{else if this.isMemberOnly}}
              <a class="ainw-cat-btn ainw-cat-btn--agent" href="/s">ADD AGENT ACCESS</a>
            {{else if this.currentUser}}
              <a class="ainw-cat-btn ainw-cat-btn--agent" href="/s">SUBSCRIBE NOW</a>
            {{else}}
              <a class="ainw-cat-btn ainw-cat-btn--agent" href="/s">SUBSCRIBE NOW</a>
            {{/if}}
          {{/unless}}
        </div>

        {{#if this.isHomepage}}
        {{#if this.isLoading}}
          <div class="ainw-loading">loading...</div>
        {{else}}

          {{!-- Pulse Bar --}}
          <div class="ainw-pulse">
            <div class="ainw-pulse__card">
              <span class="ainw-pulse__value">{{this.newCount}}</span>
              <span class="ainw-pulse__label">Since last visit</span>
            </div>
            <div class="ainw-pulse__card">
              <span class="ainw-pulse__value">{{this.activeThisWeek}}</span>
              <span class="ainw-pulse__label">Active this week</span>
            </div>
            {{#if this.currentUser}}
              <div class="ainw-pulse__card">
                <span class="ainw-pulse__value">{{this.unreadCount}}</span>
                <span class="ainw-pulse__label">Unread</span>
              </div>
            {{/if}}
          </div>

          {{!-- New Topics --}}
          {{#if this.displayNewTopics.length}}
            <h3 class="ainw-section-head">New since last visit</h3>
            {{#each this.displayNewTopics as |item|}}
              <div
                class="ainw-topic-row"
                data-category-slug={{item.categorySlug}}
              >
                <a class="ainw-topic-row__title" href={{item.url}}>
                  {{item.title}}
                </a>
                <div class="ainw-topic-row__meta">
                  <a
                    class="ainw-topic-row__cat"
                    href={{item.categoryUrl}}
                  >{{item.categoryName}}</a>
                  {{#if item.replyCount}}
                    <span class="ainw-topic-row__replies">
                      {{item.replyCount}} replies
                    </span>
                  {{/if}}
                  <span class="ainw-topic-row__time">{{item.time}}</span>
                </div>
              </div>
            {{/each}}
            {{#if this.hasMoreNewTopics}}
              <a class="ainw-read-more" href="/new">Read More</a>
            {{/if}}
          {{/if}}

          {{!-- Earlier — full width below dashboard --}}
          {{#if this.displayEarlierTopics.length}}
            <h3 class="ainw-section-head ainw-section-head--hot">Earlier</h3>
            <div class="ainw-earlier">
              {{#each this.displayEarlierTopics as |item|}}
                <div
                  class="ainw-topic-row"
                  data-category-slug={{item.categorySlug}}
                >
                  <a class="ainw-topic-row__title" href={{item.url}}>
                    {{item.title}}
                  </a>
                  <div class="ainw-topic-row__meta">
                    <a
                      class="ainw-topic-row__cat"
                      href={{item.categoryUrl}}
                    >{{item.categoryName}}</a>
                    {{#if item.replyCount}}
                      <span class="ainw-topic-row__replies">
                        {{item.replyCount}} replies
                      </span>
                    {{/if}}
                    <span class="ainw-topic-row__time">{{item.time}}</span>
                  </div>
                </div>
              {{/each}}
              {{#if this.hasMoreEarlierTopics}}
                <a class="ainw-read-more" href="/latest">Read More</a>
              {{/if}}
            </div>
          {{/if}}

          {{!-- Hot — full width below earlier --}}
          <h3 class="ainw-section-head ainw-section-head--hot">Hot</h3>
          {{#each this.displayHotTopics as |item|}}
            <div
              class="ainw-topic-row"
              data-category-slug={{item.categorySlug}}
            >
              <a class="ainw-topic-row__title" href={{item.url}}>
                {{item.title}}
              </a>
              <div class="ainw-topic-row__meta">
                <a
                  class="ainw-topic-row__cat"
                  href={{item.categoryUrl}}
                >{{item.categoryName}}</a>
                {{#if item.replyCount}}
                  <span class="ainw-topic-row__replies">
                    {{item.replyCount}} replies
                  </span>
                {{/if}}
                <span class="ainw-topic-row__time">{{item.time}}</span>
              </div>
            </div>
          {{/each}}
          {{#if this.hasMoreHotTopics}}
            <a class="ainw-read-more" href="/hot">Read More</a>
          {{/if}}

          {{!-- Events — full width below the dashboard --}}
          <div class="ainw-events-section">
            <h3 class="ainw-section-head ainw-section-head--events">Events</h3>
            <a class="ainw-events__link" href="https://luma.com/ainw" target="_blank" rel="noopener">View Full Calendar &rarr;</a>
            <div class="ainw-events">
              <iframe
                src="https://luma.com/embed/calendar/cal-rcIqzQGYrDXSlIh/events"
                width="100%"
                height="500"
                frameborder="0"
                allowfullscreen=""
                aria-hidden="false"
                tabindex="0"
              ></iframe>
            </div>
          </div>
        {{/if}}
        {{/if}}
      </div>
    {{/if}}
  </template>
}
