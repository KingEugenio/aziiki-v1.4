import { Router, type Request, type Response } from "express";

export const notificationsRouter = Router();

function fromRow(row: any) {
  return {
    id: row.id,
    businessId: row.business_id,
    type: row.type,
    referenceId: row.reference_id ?? undefined,
    title: row.title,
    message: row.message,
    emailSentAt: row.email_sent_at ?? undefined,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at,
  };
}

// Most recent 50 - unread first, then newest first - just enough for a
// banner/dropdown, not meant as a full paginated inbox.
notificationsRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("notification_log")
    .select("*")
    .eq("user_id", userId)
    .order("read_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: (data ?? []).map(fromRow) });
});

notificationsRouter.post("/:id/read", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("notification_log")
    .update({ read_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ data: fromRow(data) });
});

// Marks every unread notification as read at once - the banner's "Dismiss
// all" action.
notificationsRouter.post("/read-all", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { error } = await supabase
    .from("notification_log")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(204).send();
});
