/**
 * Whether anything is actually delivered by email.
 *
 * Nothing is today: the product owner chose in-app notifications only for
 * now, and there is no mailer. While this is false the screens offer no
 * "Email" / "In-app + email" choice, new announcements are saved as in-app,
 * and nothing claims a message was emailed. Rows already stored with channel
 * EMAIL or BOTH keep working — they are shown in the app like any other.
 *
 * Shared by the server and the browser, so it is a constant, not an env read.
 */
export const EMAIL_DELIVERY = false;

/** The channel a notification or announcement is really delivered on. */
export function effectiveChannel<C extends "IN_APP" | "EMAIL" | "BOTH">(channel: C): C | "IN_APP" {
  return EMAIL_DELIVERY ? channel : "IN_APP";
}
