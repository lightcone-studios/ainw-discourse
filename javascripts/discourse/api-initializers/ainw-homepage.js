import { apiInitializer } from "discourse/lib/api";
import AinwHomepage from "../components/ainw-homepage";

export default apiInitializer("1.0.0", (api) => {
  api.renderInOutlet("discovery-above", AinwHomepage);
});
