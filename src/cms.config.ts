/** Publication history retained per document language, including its current publication.
 * null keeps all revisions; a positive integer keeps the latest N after deployment.
 */
export const cmsConfig: { maxPublicationRevisions: number | null } = {
  maxPublicationRevisions: null,
};
