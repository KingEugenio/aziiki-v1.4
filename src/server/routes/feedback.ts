import { Router, type Request, type Response } from "express";
import { feedbackSubmissionSchema } from "../validation/feedback";

export const feedbackRouter = Router();

feedbackRouter.post("/", async (req: Request, res: Response) => {
  const parsed = feedbackSubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { error } = await supabase.from("feedback_submissions").insert({
    user_id: userId,
    name: parsed.data.name,
    email: parsed.data.email,
    message: parsed.data.message,
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({ message: "Thanks for the feedback!" });
});
