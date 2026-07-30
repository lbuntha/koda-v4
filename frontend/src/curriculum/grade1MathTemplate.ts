import type { CurriculumTree, Skill, Unit } from "./types";

export const GRADE_1_MATH_TEMPLATE_ID = "grade-1-math-complete";

interface Grade1MathTemplateContext {
  curriculumId?: string;
  gradeId: string;
  gradeLabel: string;
  gradeOrder: number;
  subjectId: string;
  subjectLabel: string;
  subjectOrder: number;
  subjectCode?: string;
  subjectIcon?: string;
  subjectColor?: string;
  title?: string;
  description?: string;
  version?: string;
}

type SkillSeed = Omit<Skill, "id" | "unitId" | "order" | "minQuestions"> & {
  id: string;
  label: string;
  standardRef: string;
  minutes?: number;
  thumbnailUrl?: string;
};

type UnitSeed = Omit<Unit, "id" | "subjectId" | "order"> & {
  id: string;
  label: string;
  skills: SkillSeed[];
};

const units: UnitSeed[] = [
  {
    id: "counting-to-120",
    label: "Counting & Number Sense to 120",
    description: "Build a reliable counting sequence and connect quantities, spoken numbers, and written numerals.",
    learningObjectives: ["Count to 120", "Start counting from any number", "Read, write, and represent numerals"],
    skills: [
      { id: "count-read-write-120", label: "Count, read, and write to 120", standardRef: "1.NBT.A.1", description: "Count to 120 and connect spoken numbers to written numerals.", thumbnailUrl: "/assets/components/number-path.svg" },
      { id: "count-on-any-number", label: "Count on from any number", standardRef: "1.NBT.A.1", description: "Continue the counting sequence from a number other than one.", thumbnailUrl: "/assets/components/number-path.svg" },
      { id: "represent-quantities", label: "Represent quantities with numerals", standardRef: "1.NBT.A.1", description: "Match a set of objects to the numeral that tells how many." },
    ],
  },
  {
    id: "addition-subtraction-stories",
    label: "Addition & Subtraction Stories",
    description: "Model the major Grade 1 addition and subtraction situations with objects, drawings, and equations.",
    learningObjectives: ["Model story problems", "Choose addition or subtraction", "Solve three-addend problems"],
    skills: [
      { id: "add-take-stories", label: "Add-to and take-from stories", standardRef: "1.OA.A.1", description: "Solve stories where a quantity grows or becomes smaller.", thumbnailUrl: "/assets/components/story-problem-mat.svg" },
      { id: "part-whole-stories", label: "Put-together and take-apart stories", standardRef: "1.OA.A.1", description: "Find a whole or a missing part using objects, drawings, or equations.", thumbnailUrl: "/assets/components/story-problem-mat.svg" },
      { id: "compare-stories", label: "Compare story problems", standardRef: "1.OA.A.1", description: "Find how many more or fewer one quantity has than another.", thumbnailUrl: "/assets/components/story-problem-mat.svg" },
      { id: "add-three-numbers", label: "Add three numbers within 20", standardRef: "1.OA.A.2", description: "Combine three whole-number groups with a total no greater than 20.", thumbnailUrl: "/assets/components/story-problem-mat.svg" },
    ],
  },
  {
    id: "operation-relationships",
    label: "How Addition & Subtraction Work",
    description: "Use operation properties and fact relationships to reason efficiently.",
    learningObjectives: ["Reorder and regroup addends", "Connect addition and subtraction"],
    skills: [
      { id: "addition-properties", label: "Reorder and regroup addends", standardRef: "1.OA.B.3", description: "Use commutative and associative properties as strategies for addition." },
      { id: "subtraction-missing-addend", label: "Think addition to subtract", standardRef: "1.OA.B.4", description: "Solve subtraction as an unknown-addend problem." },
    ],
  },
  {
    id: "fluency-within-20",
    label: "Addition & Subtraction Within 20",
    description: "Develop flexible strategies and fluent recall for foundational facts.",
    learningObjectives: ["Connect counting and operations", "Use efficient strategies", "Build fluency within 10"],
    skills: [
      { id: "counting-operation-connection", label: "Use counting to add and subtract", standardRef: "1.OA.C.5", description: "Connect counting on and counting back to addition and subtraction." },
      { id: "strategies-within-20", label: "Use strategies within 20", standardRef: "1.OA.C.6", description: "Use making ten, doubles, decomposition, and related facts." },
      { id: "fluency-within-10", label: "Fluency within 10", standardRef: "1.OA.C.6", description: "Add and subtract accurately and efficiently within 10." },
    ],
  },
  {
    id: "equations-unknowns",
    label: "Equations & Unknowns",
    description: "Understand equality and reason about missing values in addition and subtraction equations.",
    learningObjectives: ["Understand the equal sign", "Find an unknown number"],
    skills: [
      { id: "meaning-of-equal", label: "Understand the equal sign", standardRef: "1.OA.D.7", description: "Decide whether addition and subtraction equations are true or false." },
      { id: "unknown-number", label: "Find the unknown number", standardRef: "1.OA.D.8", description: "Find a missing value in an addition or subtraction equation." },
    ],
  },
  {
    id: "tens-ones",
    label: "Tens, Ones & Two-Digit Numbers",
    description: "Build place-value understanding by composing, decomposing, and comparing two-digit numbers.",
    learningObjectives: ["Bundle ten ones", "Build teen numbers", "Compare two-digit numbers"],
    skills: [
      { id: "bundle-ten", label: "Make a ten from ten ones", standardRef: "1.NBT.B.2a", description: "Understand ten ones as one bundle called a ten.", thumbnailUrl: "/assets/components/place-value-lab.svg" },
      { id: "teen-numbers", label: "Build teen numbers", standardRef: "1.NBT.B.2b", description: "Represent 11–19 as one ten and some ones.", thumbnailUrl: "/assets/components/place-value-lab.svg" },
      { id: "multiples-of-ten", label: "Understand multiples of ten", standardRef: "1.NBT.B.2c", description: "Represent 10–90 as groups of tens with zero ones.", thumbnailUrl: "/assets/components/place-value-lab.svg" },
      { id: "compare-two-digit", label: "Compare two-digit numbers", standardRef: "1.NBT.B.3", description: "Compare tens and ones using greater than, equal to, and less than." },
    ],
  },
  {
    id: "place-value-operations",
    label: "Add & Subtract with Place Value",
    description: "Use tens, ones, drawings, and operation properties to work with numbers within 100.",
    learningObjectives: ["Add within 100", "Find ten more or less", "Subtract tens"],
    skills: [
      { id: "add-within-100", label: "Add within 100", standardRef: "1.NBT.C.4", description: "Add a two-digit number to a one-digit number or a multiple of ten." },
      { id: "ten-more-less", label: "Find 10 more or 10 less", standardRef: "1.NBT.C.5", description: "Mentally find ten more or ten less than a two-digit number.", thumbnailUrl: "/assets/components/number-path.svg" },
      { id: "subtract-tens", label: "Subtract multiples of ten", standardRef: "1.NBT.C.6", description: "Subtract a multiple of ten from another multiple of ten." },
    ],
  },
  {
    id: "length-measurement",
    label: "Length & Measurement",
    description: "Compare, order, and measure lengths with equal-size units.",
    learningObjectives: ["Compare lengths", "Measure with repeated units"],
    skills: [
      { id: "compare-order-length", label: "Compare and order lengths", standardRef: "1.MD.A.1", description: "Order three objects by length and compare two lengths indirectly." },
      { id: "measure-length-units", label: "Measure with length units", standardRef: "1.MD.A.2", description: "Measure by placing equal-size units end to end without gaps or overlaps." },
    ],
  },
  {
    id: "time",
    label: "Time to the Hour & Half-Hour",
    description: "Read and write time using analog and digital clocks.",
    learningObjectives: ["Tell time to the hour", "Tell time to the half-hour"],
    skills: [
      { id: "time-hour", label: "Tell time to the hour", standardRef: "1.MD.B.3", description: "Read and write hour times on analog and digital clocks." },
      { id: "time-half-hour", label: "Tell time to the half-hour", standardRef: "1.MD.B.3", description: "Read and write half-hour times on analog and digital clocks." },
    ],
  },
  {
    id: "data",
    label: "Organize & Interpret Data",
    description: "Sort data into categories and answer questions about the results.",
    learningObjectives: ["Organize categorical data", "Interpret and compare categories"],
    skills: [
      { id: "organize-data", label: "Organize data in up to three categories", standardRef: "1.MD.C.4", description: "Sort and represent information using up to three categories." },
      { id: "interpret-data", label: "Ask and answer questions about data", standardRef: "1.MD.C.4", description: "Find totals and compare how many more or fewer are in each category." },
    ],
  },
  {
    id: "geometry-fractions",
    label: "Shapes & Equal Shares",
    description: "Reason about shape attributes, compose shapes, and partition wholes into equal shares.",
    learningObjectives: ["Describe defining attributes", "Compose shapes", "Partition into halves and fourths"],
    skills: [
      { id: "shape-attributes", label: "Describe and build shapes", standardRef: "1.G.A.1", description: "Distinguish defining attributes and use them to draw or build shapes." },
      { id: "compose-shapes", label: "Compose two- and three-dimensional shapes", standardRef: "1.G.A.2", description: "Join shapes to make composite shapes and create new shapes from them." },
      { id: "equal-shares", label: "Partition shapes into equal shares", standardRef: "1.G.A.3", description: "Divide circles and rectangles into halves and fourths and describe the shares." },
    ],
  },
];

const accents = ["purple", "blue", "green", "amber", "pink"] as const;

/** A standards-aligned draft outline. It intentionally contains no fabricated questions or learner results. */
export function createGrade1MathTemplate(context: Grade1MathTemplateContext): CurriculumTree {
  const prefix = "g1-math";
  const curriculumUnits: Unit[] = units.map((unit, index) => ({
    id: `${prefix}-unit-${unit.id}`,
    subjectId: context.subjectId,
    label: unit.label,
    order: index + 1,
    description: unit.description,
    learningObjectives: unit.learningObjectives,
  }));

  const skills: Skill[] = units.flatMap((unit, unitIndex) => unit.skills.map((skill, skillIndex) => ({
    id: `${prefix}-skill-${skill.id}`,
    unitId: `${prefix}-unit-${unit.id}`,
    label: skill.label,
    description: skill.description,
    standardRef: skill.standardRef,
    order: skillIndex + 1,
    minQuestions: 5,
    presentation: {
      title: skill.label,
      description: skill.description,
      estimatedMinutes: skill.minutes ?? 5,
      accent: accents[(unitIndex + skillIndex) % accents.length],
      thumbnailUrl: skill.thumbnailUrl,
    },
  })));

  return {
    id: context.curriculumId,
    title: context.title || "Grade 1 Mathematics",
    description: context.description || "A complete Grade 1 mathematics scope covering operations, place value, measurement, time, data, and geometry.",
    version: context.version || "1.0",
    primaryGradeId: context.gradeId,
    primarySubjectId: context.subjectId,
    grades: [{ id: context.gradeId, label: context.gradeLabel, order: context.gradeOrder }],
    subjects: [{
      id: context.subjectId,
      gradeId: context.gradeId,
      label: context.subjectLabel,
      order: context.subjectOrder,
      code: context.subjectCode,
      icon: context.subjectIcon,
      color: context.subjectColor,
    }],
    units: curriculumUnits,
    skills,
  };
}

export const GRADE_1_MATH_TEMPLATE_COUNTS = {
  units: units.length,
  skills: units.reduce((total, unit) => total + unit.skills.length, 0),
};
