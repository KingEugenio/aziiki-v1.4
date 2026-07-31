import { z } from "zod";
import { nonEmptyString } from "./common";

export const feedbackSubmissionSchema = z.object({
  name: nonEmptyString.max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  message: nonEmptyString.max(4000),
});
