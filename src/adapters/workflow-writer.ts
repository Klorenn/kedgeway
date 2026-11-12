import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export interface WorkflowWriteResult {
  status: "written" | "exists";
  path: string;
}

/**
 * Writes `text` to `<root>/<relPath>`, creating parent directories. Without `force` the file is created
 * exclusively (never overwrites); with `force` it is replaced atomically through a temp file.
 */
export async function writeWorkflow(root: string, relPath: string, text: string, opts: { force: boolean }): Promise<WorkflowWriteResult> {
  if (!(await stat(root).then((s) => s.isDirectory(), () => false))) throw new Error(`${root} is not a directory`);
  const path = join(root, relPath);
  await mkdir(dirname(path), { recursive: true });
  if (!opts.force) {
    try {
      await writeFile(path, text, { flag: "wx" });
      return { status: "written", path };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") return { status: "exists", path };
      throw e;
    }
  }
  const tmp = join(dirname(path), `.${basename(path)}.kedgeway-${randomBytes(6).toString("hex")}.tmp`);
  try {
    await writeFile(tmp, text, { flag: "wx" });
    await rename(tmp, path);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
  return { status: "written", path };
}
