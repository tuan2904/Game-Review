import { client } from "./client";

/**
 * User content reporting (docs/API.md — Report API), verified against the
 * backend views:
 *
 *  - POST /reviews/{id}/report/    authenticated; body `{reason, details?}`;
 *    201 "Report submitted successfully". The target always comes from the
 *    URL — a crafted body cannot redirect the report. 409 when this account
 *    already reported the same content; 404 when the content is invisible
 *    to the caller (inactive game or hidden comment).
 *  - POST /comments/{id}/report/   same contract for comments.
 *
 * Reason values mirror `Report.Reason` on the backend — keep in sync with
 * apps/reports/models.py.
 */

export const REPORT_REASONS = [
  { value: "SPAM", label: "Spam or advertising" },
  { value: "HARASSMENT", label: "Harassment or abuse" },
  { value: "OFF_TOPIC", label: "Off-topic" },
  { value: "MISLEADING", label: "Misleading information" },
  { value: "OTHER", label: "Other" },
];

/**
 * Report a review.
 *
 * @param {number} id review id
 * @param {{reason: string, details?: string}} payload
 * @returns {Promise<import("../types").Report>} 201 with the stored report
 */
export function reportReview(id, payload) {
  return client.post(`/reviews/${id}/report/`, payload);
}

/**
 * Report a comment.
 *
 * @param {number} id comment id
 * @param {{reason: string, details?: string}} payload
 * @returns {Promise<import("../types").Report>} 201 with the stored report
 */
export function reportComment(id, payload) {
  return client.post(`/comments/${id}/report/`, payload);
}
