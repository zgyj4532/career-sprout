import { ZodError } from 'zod';

/**
 * Formats a ZodError into a structured array of field-level errors.
 *
 * Each element contains:
 *  - field  : dot-joined path (e.g. "preferences.jobRole")
 *  - message: human-readable description
 *
 * @param {ZodError} zodError
 * @returns {{ field: string, message: string }[]}
 */
const formatZodErrors = (zodError) =>
  (zodError.issues ?? zodError.errors).map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
  }));


const campusFields = new Set(['root', 'interests', 'experiences', 'id', 'kind', 'title', 'context', 'actions', 'result', 'skillAssessments', 'name', 'level', 'evidence', 'availability', 'startDate', 'endDate', 'daysPerWeek', 'targetJobId', 'company', 'description', 'source', 'authorKind', 'requirements', 'required', 'status', 'sourceText', 'jobId', 'draft', 'revision', 'teacherId', 'targetIds', 'displayName', 'studyStage', 'education', 'institution', 'degree', 'field', 'startYear', 'endYear', 'skills', 'bio', 'jobRole', 'location', 'website', 'github', 'linkedin', 'avatarUrl', 'phone', 'headline', 'dateOfBirth', 'gender', 'yearsOfExperience', 'collegeStudent', 'openToWork', 'languages', 'resumeHeadline', 'originalText', 'enhancedText', 'preferences', 'industry', 'experienceLevel', 'questionCount', 'resumeText', 'resumeId', 'mode', 'language', 'companyName', 'companyRole', 'codingLanguage', 'jobDescriptionText', 'skipWarmup', 'version', 'paperSize']);
const issueCodes = new Set(['invalid_type', 'invalid_value', 'invalid_format', 'too_small', 'too_big', 'not_multiple_of', 'unrecognized_keys', 'invalid_union', 'invalid_key', 'invalid_element', 'custom']);

export function safeValidationDetails(details) {
  if (!Array.isArray(details)) return [];
  return details.slice(0, 12).flatMap((detail) => {
    if (typeof detail?.field !== 'string' || detail.field.length > 120 || !issueCodes.has(detail.code)) return [];
    const parts = detail.field.split('.');
    if (parts.length > 6 || !parts.every((part) => campusFields.has(part) || /^\d{1,3}$/.test(part))) return [];
    return [{ field: detail.field, code: detail.code }];
  });
}

export function campusValidationDetails(error) {
  return safeValidationDetails((error.issues ?? error.errors ?? []).map((issue) => ({ field: issue.path.join('.') || 'root', code: issue.code })));
}
/**
 * Factory that returns an Express middleware validating the chosen part of the
 * request (body | query | params) against a Zod schema.
 *
 * On success the validated (and potentially transformed/defaulted) data is
 * written back to `req[target]` so downstream handlers receive clean data.
 *
 * On failure a structured 400 response is sent:
 * ```json
 * {
 *   "success": false,
 *   "error": "Validation failed",
 *   "details": [
 *     { "field": "title", "message": "Required" },
 *     { "field": "preferences.jobRole", "message": "Expected string, received number" }
 *   ]
 * }
 * ```
 *
 * @param {import('zod').ZodTypeAny} schema - Zod schema to validate against
 * @param {'body'|'query'|'params'} [target='body'] - which part of req to validate
 * @returns {import('express').RequestHandler}
 *
 * @example
 * import { validate } from '../middleware/validate.js';
 * import { createResumeSchema } from '../schemas/resume.schema.js';
 *
 * router.post('/', verifyToken, validate(createResumeSchema), asyncHandler(handler));
 */
export const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        ...(req.campusRequest ? { code: 'VALIDATION_FAILED', details: campusValidationDetails(result.error) } : { details: formatZodErrors(result.error) }),
      });
    }

    // Replace req[target] with the parsed (possibly transformed) data
    req[target] = result.data;

    next();
  };
};
