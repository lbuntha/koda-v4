export interface MathConcept {
  id: string;
  term: string;
  category: "Foundations (G1/2)" | "Algebra" | "Fractions" | "Geometry" | "Exponents" | "Coordinates" | "Logic";
  definition: string;
  visualRepresentation: string; // ASCII or LaTeX/HTML visual representation
  example: string;
  socraticQuestion: string;
}

export const MATH_CONCEPTS: MathConcept[] = [
  {
    id: "number_bonds",
    term: "Number Bonds & Part-Part-Whole (G1)",
    category: "Foundations (G1/2)",
    definition: "A visual model showing how a whole number splits into parts, or how parts combine to make a whole.",
    visualRepresentation: "      [ 10 (Whole) ]\n       /          \\\n[ 6 (Part) ]    [ 4 (Part) ]",
    example: "6 + 4 = 10 and 10 - 6 = 4.",
    socraticQuestion: "If you have 10 crystals and 7 are blue, how many crystals must be purple?"
  },
  {
    id: "ten_frame",
    term: "Ten-Frame & Making 10 (G1)",
    category: "Foundations (G1/2)",
    definition: "A 2x5 grid used to build visual mental models of numbers 1-10 and anchor calculations to ten.",
    visualRepresentation: "┌───┬───┬───┬───┬───┐\n│ 🔵│ 🔵│ 🔵│ 🔵│ 🔵│\n├───┼───┼───┼───┼───┤\n│ 🔵│ 🟣│ 🟣│ 🟣│ 🟣│  ➔ 6 + 4 = 10\n└───┴───┴───┴───┴───┘",
    example: "Filling the top row (5) plus 3 more gives 8. Two empty slots remain to reach 10.",
    socraticQuestion: "How many empty spots are in a ten-frame if you place 8 counters inside?"
  },
  {
    id: "base_ten_place_value",
    term: "Base-10 Place Value (G1/2)",
    category: "Foundations (G1/2)",
    definition: "The value of a digit depends on its place in the number. 10 ones group into 1 ten-rod; 10 ten-rods group into 1 hundred-flat.",
    visualRepresentation: "Tens (10s)        Ones (1s)\n[ ▮▮▮ ] (30)   +   [ ▪▪▪▪ ] (4)  =  34",
    example: "In the number 34, the digit 3 represents 30 and the digit 4 represents 4.",
    socraticQuestion: "If you trade 10 one-cubes for 1 ten-rod, did your total number change?"
  },
  {
    id: "regrouping",
    term: "Regrouping / Carrying & Borrowing (G2)",
    category: "Foundations (G1/2)",
    definition: "Reorganizing numbers into equal groups of tens or ones to make adding or subtracting easier.",
    visualRepresentation: "14 Ones  ──[ Regroup 10 ]──>  1 Ten + 4 Ones",
    example: "When adding 28 + 5: 8+5 = 13. Regroup 10 ones as 1 ten + 3 ones ➔ 33.",
    socraticQuestion: "Why do we group 10 ones together instead of letting them stay loose?"
  },
  {
    id: "analog_time",
    term: "Analog Clock Hands & Minutes (G2)",
    category: "Foundations (G1/2)",
    definition: "The short hand points to the hour, while the long hand counts minutes in steps of 5 around the 60-minute circle.",
    visualRepresentation: "Short Hand ➔ 3 (Hour 3)\nLong Hand  ➔ 6 (30 Mins)\nTime: 3:30 (Half-past 3)",
    example: "When the long minute hand points to 3, it represents 15 minutes past the hour (quarter past).",
    socraticQuestion: "How many minutes pass when the minute hand moves from 12 all the way around to 6?"
  },
  {
    id: "coin_currency",
    term: "Coins & Money Denominations (G2)",
    category: "Foundations (G1/2)",
    definition: "Standard currency coins: Penny (1¢), Nickel (5¢), Dime (10¢), and Quarter (25¢). 100 cents = $1.00.",
    visualRepresentation: "🪙 Quarter (25¢) + 🪙 Quarter (25¢) = 50¢ (Half Dollar)\n🪙 10 Dimes = $1.00",
    example: "2 Quarters (50¢) + 1 Dime (10¢) + 1 Nickel (5¢) = 65¢.",
    socraticQuestion: "How many nickels do you need to equal the value of one quarter?"
  },
  {
    id: "subtractive_equality",
    term: "Subtractive Equality",
    category: "Algebra",
    definition: "If you subtract the exact same weight or value from both sides of a balanced equation or scale, the scale remains perfectly balanced.",
    visualRepresentation: "Pan A (x + 5kg)  ===⚖️===  Pan B (12kg)\nRemove 5kg from both:\nPan A (x)        ===⚖️===  Pan B (7kg)",
    example: "If x + 5 = 12, taking 5 away from both sides gives x = 7.",
    socraticQuestion: "If you remove 2 weights from the left side of a balanced scale, what must you do to the right side to keep it horizontal?"
  },
  {
    id: "inverse_operations",
    term: "Inverse Operations",
    category: "Algebra",
    definition: "Operations that undo each other. Addition is the inverse of subtraction, and multiplication is the inverse of division.",
    visualRepresentation: "Start: x  ──[ + 4 ]──>  x + 4\nUndo:  x + 4  ──[ - 4 ]──>  x",
    example: "To undo 'multiplying by 3', you perform the inverse: 'dividing by 3'.",
    socraticQuestion: "How can you 'undo' multiplying a mystery number by 5?"
  },
  {
    id: "variable",
    term: "Variable / Unknown (x)",
    category: "Algebra",
    definition: "A symbol or mystery box representing a number whose value is not yet known.",
    visualRepresentation: "[ 📦 Mystery Box X ] = 3 Kg",
    example: "In 2x = 8, the variable x stands for 4.",
    socraticQuestion: "If 3 identical mystery boxes weigh 15 kg together, how much does one box weigh?"
  },
  {
    id: "equivalent_fractions",
    term: "Equivalent Fractions",
    category: "Fractions",
    definition: "Fractions that represent the exact same proportion or amount of a whole, even though they use different numerators and denominators.",
    visualRepresentation: "[ 🥧 1/2 ]  is equal in size to  [ 🥧 2/4 ]  and  [ 🥧 4/8 ]",
    example: "Slice a pizza into 2 pieces and eat 1 (1/2), or slice it into 4 pieces and eat 2 (2/4). You've eaten the exact same amount of pizza!",
    socraticQuestion: "If you slice a pie into twice as many pieces, how many pieces do you need to eat the same total amount?"
  },
  {
    id: "improper_fractions",
    term: "Improper Fractions & Mixed Numbers",
    category: "Fractions",
    definition: "An improper fraction has a numerator larger than or equal to its denominator (e.g. 7/4), representing more than one whole. A mixed number combines whole numbers and fractions (1 3/4).",
    visualRepresentation: "7/4  =  [ 🥧 Whole (4/4) ] + [ 🥧 3/4 ] = 1 3/4",
    example: "7 fourths of a pizza is 1 full pizza and 3 remaining slices.",
    socraticQuestion: "How many whole pizzas can you make out of 9 fourth-slices?"
  },
  {
    id: "area_vs_perimeter",
    term: "Area vs. Perimeter",
    category: "Geometry",
    definition: "Area measures the total 2D space inside a shape (Width × Height). Perimeter measures the total distance along the outside boundary (2×Width + 2×Height).",
    visualRepresentation: "┌─────────┐ Perimeter = Border line (2W + 2H)\n│  AREA   │ Area = Filled grid space (W × H)\n└─────────┘",
    example: "A 4×3 rectangle has an Area of 12 sq units and a Perimeter of 14 units.",
    socraticQuestion: "If you double the width of a rectangle, does the area double, or does it quadruple?"
  },
  {
    id: "exponential_growth",
    term: "Exponential Growth (2ⁿ)",
    category: "Exponents",
    definition: "A pattern of growth where a quantity doubles or multiplies at each constant step, causing rapid acceleration.",
    visualRepresentation: "Step 0: 🟢 (1)\nStep 1: 🟢🟢 (2)\nStep 2: 🟢🟢🟢🟢 (4)\nStep 3: 🟢🟢🟢🟢🟢🟢🟢🟢 (8)",
    example: "A cell dividing into 2 cells every minute: 1, 2, 4, 8, 16, 32, 64...",
    socraticQuestion: "If bacteria double every hour, how many times larger is the population after 4 hours compared to 1 hour?"
  },
  {
    id: "base_and_exponent",
    term: "Base and Exponent",
    category: "Exponents",
    definition: "In bᵉ, 'b' is the base (the number being multiplied) and 'e' is the exponent (how many times the base multiplies itself).",
    visualRepresentation: "3⁴  =  3 × 3 × 3 × 3  =  81\n↑ Base = 3, Exponent = 4",
    example: "5³ = 5 × 5 × 5 = 125.",
    socraticQuestion: "What is the difference between 2 × 3 and 2³?"
  },
  {
    id: "cartesian_coordinates",
    term: "Cartesian Coordinates (X, Y)",
    category: "Coordinates",
    definition: "A system for locating points on a 2D plane using a horizontal position (X) and vertical position (Y), written as (X, Y).",
    visualRepresentation: " Y ↑\n 3 ┼      • (2, 3)\n 2 ┼      │\n 1 ┼      │\n 0 ┴──┬──┬──┬──> X\n   0  1  2  3",
    example: "Point (3, 5) means move 3 steps right along the X-axis, then 5 steps up along the Y-axis.",
    socraticQuestion: "If you move 4 steps left and 2 steps down from (0,0), what are your coordinates?"
  },
  {
    id: "boolean_logic",
    term: "Boolean Logic (AND, OR, NOT)",
    category: "Logic",
    definition: "A system of symbolic logic where statements evaluate to TRUE or FALSE. AND requires all inputs true; OR requires at least one input true; NOT flips true to false.",
    visualRepresentation: "A [TRUE]  ──┐\n            ├─[ AND Gate ]──> [ TRUE ]\nB [TRUE]  ──┘",
    example: "To go outside, you need (Shoes = TRUE) AND (Door Open = TRUE).",
    socraticQuestion: "If Signal A is TRUE and Signal B is FALSE, what is the output of an OR gate versus an AND gate?"
  }
];
