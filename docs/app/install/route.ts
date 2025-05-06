import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-static";

export async function GET() {
  try {
    // Get the absolute path to the project root
    const projectRoot = process.cwd();
    const filePath = path.join(projectRoot, "../", "install.sh");

    // Read the file content
    const fileContent = fs.readFileSync(filePath, "utf8");

    // Return the content as plain text
    return new NextResponse(fileContent, {
      headers: {
        "Content-Type": "text/plain",
      },
    });
  } catch (error) {
    console.error("Error reading file:", error);
    return new NextResponse("File not found or could not be read", {
      status: 404,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
}
