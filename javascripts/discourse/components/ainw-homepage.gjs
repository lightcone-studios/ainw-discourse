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

  get shouldShow() {
    return (
      !this.hasError &&
      this.router.currentRouteName === `discovery.${defaultHomepage()}`
    );
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

  get nextEvent() {
    return settings.next_event || "";
  }

  // Pre-compute display data so templates stay simple
  get displayNewTopics() {
    return this._formatTopics(this.newTopics);
  }

  get displayEarlierTopics() {
    return this._formatTopics(this.earlierTopics);
  }

  get displayPinnedTopics() {
    return this._formatTopics(this.topics.filter((t) => t.pinned));
  }

  get displayCategories() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return Category.list()
      .filter((cat) => !cat.parent_category_id)
      .map((cat) => {
        const catTopics = this.topics.filter(
          (t) => t.category_id === cat.id
        );
        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description_excerpt || "",
          topicsThisWeek: catTopics.filter(
            (t) => new Date(t.created_at) > weekAgo
          ).length,
          newSinceVisit: catTopics.filter(
            (t) => new Date(t.created_at) > this.lastSeenAt
          ).length,
          url: `/c/${cat.slug}/${cat.id}`,
        };
      });
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
            {{#if this.nextEvent}}
              <div class="ainw-pulse__card ainw-pulse__card--event">
                <span class="ainw-pulse__value">→</span>
                <span class="ainw-pulse__label">{{this.nextEvent}}</span>
              </div>
            {{/if}}
          </div>

          {{!-- Dashboard: Feed + Sidebar --}}
          <div class="ainw-dashboard">

            <div class="ainw-dashboard__feed">
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
              {{/if}}

              {{#if this.displayEarlierTopics.length}}
                <h3 class="ainw-section-head">Earlier</h3>
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
                </div>
              {{/if}}
            </div>

            <aside class="ainw-dashboard__sidebar">
              <h3 class="ainw-section-head">Lanes</h3>
              {{#each this.displayCategories as |cat|}}
                <a class="ainw-lane" href={{cat.url}} data-category-slug={{cat.slug}}>
                  <span class="ainw-lane__name">{{cat.name}}</span>
                  {{#if cat.description}}
                    <span class="ainw-lane__desc">{{cat.description}}</span>
                  {{/if}}
                  <span class="ainw-lane__stats">
                    {{cat.topicsThisWeek}}/wk
                    {{#if cat.newSinceVisit}}
                      · {{cat.newSinceVisit}} new
                    {{/if}}
                  </span>
                </a>
              {{/each}}

              {{#if this.displayPinnedTopics.length}}
                <h3 class="ainw-section-head ainw-section-head--pinned">Pinned</h3>
                {{#each this.displayPinnedTopics as |item|}}
                  <a class="ainw-pinned" href={{item.url}}>
                    {{item.title}}
                  </a>
                {{/each}}
              {{/if}}
            </aside>

          </div>
        {{/if}}
      </div>
    {{/if}}
  </template>
}
