/**
 * URERB Review Portal - Express Server
 *
 * Main entry point that starts the HTTP listener.
 */
import "dotenv/config";
import app from "./app";
import { logger } from "./config/logger";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Server listening on http://localhost:${PORT}`);
});
