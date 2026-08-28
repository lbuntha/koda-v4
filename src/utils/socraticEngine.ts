import { ProblemItem } from "../types";

export interface SocraticResponse {
  replyText: string;
  hintType: "question" | "visual_clue" | "encouragement" | "celebration" | "concept_check";
  suggestedManipulativeAction?: string;
  isCorrect: boolean | null;
  xpEarned: number;
  audioSpeechText: string;
}

export function generateLocalSocraticResponse(
  problem: ProblemItem,
  userMessage: string,
  state: any,
  topic: string
): SocraticResponse {
  const msg = (userMessage || "").toLowerCase();

  // 1. Check if user is testing a manipulative state / configuration
  if (msg.includes("tested a configuration") || msg.includes("does this balance") || msg.includes("is this correct")) {
    // Check if problem is balance
    if (topic === "balance_equations" || problem.topic === "balance_equations") {
      const leftTotal = (state?.leftPan || []).reduce((acc: number, item: any) => acc + (item.value || 0), 0);
      const rightTotal = (state?.rightPan || []).reduce((acc: number, item: any) => acc + (item.value || 0), 0);

      if (leftTotal > 0 && leftTotal === rightTotal) {
        return {
          replyText: `🎯 Incredible visual balance! Both sides have an equal total mass of ${leftTotal}. Because the balance scale is level, your algebraic equality holds true! You deduced the value of X.`,
          hintType: "celebration",
          isCorrect: true,
          xpEarned: 60,
          audioSpeechText: "Incredible balance! Both sides have equal mass. You solved it!",
        };
      } else {
        const diff = Math.abs(leftTotal - rightTotal);
        const heavierSide = leftTotal > rightTotal ? "left side is currently heavier" : "right side is currently heavier";
        return {
          replyText: `⚖️ Great experiment! Look closely at the scale: the ${heavierSide} by ${diff} kg. What happens if you remove matching weights from both sides to isolate the mystery box?`,
          hintType: "visual_clue",
          isCorrect: false,
          xpEarned: 15,
          audioSpeechText: "Good experiment! Look at which side is heavier and try isolating the mystery box.",
        };
      }
    }

    // Fraction lab
    if (topic === "fraction_lab" || problem.topic === "fraction_lab") {
      const targetFrac = problem.initialManipulativeState?.targetFraction || problem.targetValue || "the target fraction";
      return {
        replyText: `🥧 Look at your fraction slices! Count how many total slices make a full circle. Does your selected shaded area match ${targetFrac}?`,
        hintType: "visual_clue",
        isCorrect: null,
        xpEarned: 20,
        audioSpeechText: "Look at your fraction slices and compare them to the target fraction.",
      };
    }

    // Number Bonds (Grade 1)
    if (topic === "number_bonds" || problem.topic === "number_bonds") {
      if (state?.isSolved) {
        return {
          replyText: `🎉 Outstanding! ${state.partA} + ${state.partB} = ${state.targetWhole}! You mastered this number bond and filled the ten-frame!`,
          hintType: "celebration",
          isCorrect: true,
          xpEarned: 60,
          audioSpeechText: `Outstanding! ${state.partA} plus ${state.partB} equals ${state.targetWhole}! You solved the number bond!`,
        };
      } else {
        const diff = (state?.targetWhole || 10) - (state?.currentSum || 0);
        return {
          replyText: `🔢 You currently have ${state?.currentSum || 0} counters in your number bond (Target: ${state?.targetWhole || 10}). You need ${diff > 0 ? `+${diff}` : `${diff}`} more to complete the whole!`,
          hintType: "visual_clue",
          isCorrect: false,
          xpEarned: 15,
          audioSpeechText: `You have ${state?.currentSum || 0}. Look how many more you need to reach ${state?.targetWhole || 10}.`,
        };
      }
    }

    // Base Ten Blocks (Grade 1 & 2)
    if (topic === "base_ten_blocks" || problem.topic === "base_ten_blocks") {
      if (state?.isSolved) {
        return {
          replyText: `🌟 Fantastic place-value mastery! ${state.tens} Tens (${state.tens * 10}) + ${state.ones} Ones = ${state.targetNumber}! Your place value model is spot on!`,
          hintType: "celebration",
          isCorrect: true,
          xpEarned: 65,
          audioSpeechText: `Fantastic place value mastery! You built ${state.targetNumber} perfectly!`,
        };
      } else {
        return {
          replyText: `🧱 Look at your place value mat: you have ${state?.tens || 0} Tens (${(state?.tens || 0) * 10}) and ${state?.ones || 0} Ones (${state?.currentValue || 0} total). How can you adjust your blocks to reach ${state?.targetNumber || problem.targetValue}?`,
          hintType: "visual_clue",
          isCorrect: false,
          xpEarned: 15,
          audioSpeechText: `Check your tens and ones. How can you adjust them to reach ${state?.targetNumber}?`,
        };
      }
    }

    // Time and Money (Grade 2)
    if (topic === "time_and_money" || problem.topic === "time_and_money") {
      if (state?.isSolved) {
        return {
          replyText: `✨ Brilliant job! ${state.currentTimeString ? `The clock is set accurately to ${state.currentTimeString}` : `Your coin total is exactly ${state.totalCents}¢ ($${(state.totalCents / 100).toFixed(2)})`}!`,
          hintType: "celebration",
          isCorrect: true,
          xpEarned: 60,
          audioSpeechText: "Brilliant job! You got the exact target!",
        };
      } else {
        return {
          replyText: `⏰ / 🪙 Keep going! ${state?.currentTimeString ? `Your clock currently reads ${state.currentTimeString}. Look closely at the hour and minute hands for ${state.targetTime}.` : `Your register currently has ${state?.totalCents || 0}¢ (Target: ${state?.targetCents || 0}¢). Try adding or swapping coins!`}`,
          hintType: "visual_clue",
          isCorrect: false,
          xpEarned: 15,
          audioSpeechText: "Keep going! Check your target and adjust your settings.",
        };
      }
    }

    // General manipulative check
    return {
      replyText: `🔍 Nice move! Notice how the visual manipulative changed. How does this bring you closer to ${problem.title}?`,
      hintType: "question",
      isCorrect: null,
      xpEarned: 15,
      audioSpeechText: "Nice move! Notice how the visual manipulative changed.",
    };
  }

  // 2. Check if user is asking for a hint
  if (msg.includes("hint") || msg.includes("help") || msg.includes("how to") || msg.includes("stuck")) {
    const hintList = problem.socraticHints && problem.socraticHints.length > 0
      ? problem.socraticHints
      : [
          "Look at the visual elements on screen. What changes when you adjust one piece?",
          "Can you break the problem down into smaller, simpler visual steps?",
          "What is the relationship between the left side and the right side?",
        ];
    const pickedHint = hintList[Math.floor(Math.random() * hintList.length)];

    return {
      replyText: `💡 Here is a Socratic clue to guide your thinking:\n\n"${pickedHint}"\n\nWhat do you notice when you try that on the visual model?`,
      hintType: "question",
      isCorrect: null,
      xpEarned: 10,
      audioSpeechText: pickedHint,
    };
  }

  // 3. Check if user typed a numeric answer
  const numberMatch = msg.match(/\b\d+(\.\d+)?\b/);
  if (numberMatch && problem.targetValue) {
    const attemptedNum = numberMatch[0];
    if (attemptedNum === problem.targetValue.trim()) {
      return {
        replyText: `🌟 Brilliant reasoning! ${attemptedNum} is exactly correct for ${problem.title}!\n\n${problem.conceptExplanation}`,
        hintType: "celebration",
        isCorrect: true,
        xpEarned: 75,
        audioSpeechText: `Brilliant reasoning! ${attemptedNum} is exactly correct!`,
      };
    } else {
      return {
        replyText: `🤔 Interesting hypothesis with ${attemptedNum}! Let's test that on the manipulative: if you substitute ${attemptedNum} into the visual model, does everything stay balanced?`,
        hintType: "concept_check",
        isCorrect: false,
        xpEarned: 15,
        audioSpeechText: `Let's test ${attemptedNum} on the visual model. Does it keep everything balanced?`,
      };
    }
  }

  // 4. General conversational or inquisitive prompt
  return {
    replyText: `👋 I'm right here with you! For "${problem.title}", take a look at the interactive canvas. What strategy do you want to explore first?`,
    hintType: "encouragement",
    isCorrect: null,
    xpEarned: 10,
    audioSpeechText: "I'm right here with you! What strategy do you want to explore first?",
  };
}
