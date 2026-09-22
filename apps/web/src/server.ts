import { createHandler } from "@angular/ssr";
import bootstrap from "./main.server";
export default { fetch: createHandler(bootstrap) };
