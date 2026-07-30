// Module composition starts here. Each module owns one business area while
// sharing this single Express process and PostgreSQL database.
export { createUsersModule } from "./users/users.module.js";
export { createNotificationsModule } from "./notifications/notifications.module.js";
export { createAuthenticationModule } from "./authentication/authentication.module.js";
export { createRecruitmentCyclesModule } from "./recruitment-cycles/recruitment-cycles.module.js";
export { createRegistrationsModule } from "./registrations/registrations.module.js";
