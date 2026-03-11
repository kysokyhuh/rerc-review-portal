import { Router } from "express";
import { RoleType } from "../generated/prisma/client";
import { requireAnyRole } from "../middleware/auth";
import { listExemptedQueue } from "../services/exemptService";

const router = Router();

router.get(
  "/queues/exempted",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  async (req, res, next) => {
    try {
      const pageRaw = Number(req.query.page ?? 1);
      const pageSizeRaw = Number(req.query.pageSize ?? 20);
      const page = Number.isFinite(pageRaw) ? pageRaw : 1;
      const pageSize = Number.isFinite(pageSizeRaw) ? pageSizeRaw : 20;

      const result = await listExemptedQueue({
        page,
        pageSize,
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        college: typeof req.query.college === "string" ? req.query.college : undefined,
        committee:
          typeof req.query.committee === "string" ? req.query.committee : undefined,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
