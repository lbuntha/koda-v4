import { describeActivitySmoke, describeSkillContract } from "../kit/testing";
import { skill } from ".";

describeSkillContract(skill);
describeActivitySmoke(skill);
