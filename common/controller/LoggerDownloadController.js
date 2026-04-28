import fs from "fs";
import path from "path";

export const loggercheck = async (req, resp) => {
  const logPath = path.join(process.cwd(), "error.log");

  if (!fs.existsSync(logPath)) {
    return resp.status(404).json({
      success: false,
      message: "error.log file not found",
    });
  }

  const data = fs.readFileSync(logPath, "utf8");

  // return resp.status(200).json({
  //   success: true,
  //   logs: data,
  // });
    return resp.download(logPath, "error.log", (err) => {
    if (err) {
      console.error("Download error:", err);
      resp.status(500).json({
        success: false,
        message: "Error downloading file",
      });
    }
  });

};
