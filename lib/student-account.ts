import { randomBytes } from "node:crypto";

export function generateStudentAccountCredentials(studentCode: string) {
  const loginCode = studentCode.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "student";
  return {
    email: `${loginCode}.${randomBytes(4).toString("hex")}@students.albayyan.edu`,
    temporaryPassword: randomBytes(18).toString("base64url"),
  };
}
