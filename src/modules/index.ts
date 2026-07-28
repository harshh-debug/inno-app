// Module composition starts here. Each module owns one business area while
// sharing this single Express process and PostgreSQL database.
export { createUsersModule } from "./users/users.module.js";
