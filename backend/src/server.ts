/**
 * URERD Review Portal - Express Server
 *
 * Main entry point that starts the HTTP listener.
 */
import "dotenv/config";
import app from "./app";
const PORT = process.env.PORT || 3000;
// =============================================================================
// Start Server
// =============================================================================

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
