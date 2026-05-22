import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schoolsPath = path.join(root, "data", "schools.json");
const patchDir = path.join(root, "data", "research-patches");

const data = JSON.parse(fs.readFileSync(schoolsPath, "utf8"));
const patchFiles = fs.existsSync(patchDir)
  ? fs
      .readdirSync(patchDir)
      .filter((file) => file.endsWith(".json"))
      .sort()
  : [];

const schoolsById = new Map(data.schools.map((school) => [school.id, school]));

const isPlainObject = (value) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value);

const mergeDeep = (target, source) => {
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      mergeDeep(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
};

for (const file of patchFiles) {
  const patchPath = path.join(patchDir, file);
  const patch = JSON.parse(fs.readFileSync(patchPath, "utf8"));
  for (const update of patch.schools ?? []) {
    if (!schoolsById.has(update.id)) {
      throw new Error(`${file}: unknown school id ${update.id}`);
    }
    const existing = schoolsById.get(update.id);
    mergeDeep(existing, update);
  }
}

fs.writeFileSync(schoolsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Applied ${patchFiles.length} research patch file(s).`);
