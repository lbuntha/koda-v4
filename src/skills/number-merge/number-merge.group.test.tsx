import { describeGroupPlay } from "../kit/testing";
import { skill } from ".";

// Every lesson, mounted twice from one room seed, deals the same first board.
describeGroupPlay(skill);
