import fs from "fs";
import path from "path";

export interface Player {
  id: string;
  name: string;
  dkUsername: string | null;
}

export interface ContestResult {
  rank: number;
  dkUsername: string;
  playerId: string | null;
  playerName: string;
  dkPoints: number;
  leaguePoints: number;
  lineup: string;
}

export interface Tournament {
  slug: string;
  name: string;
  year: number;
  entrants: number;
  results: ContestResult[];
}

export interface PlayerStanding {
  name: string;
  total: number;
  results: Record<string, number | null>;
}

export interface PlayerMoney {
  name: string;
  entered: number;
  owed: number;
  paid: number;
  yearlyEntry: number;
  tournaments: Record<string, number | null>;
  overall: number;
}

export interface Season {
  year: number;
  seasonBonus?: number;
  seasonBonusExclusions?: string[];
  tournaments: Tournament[];
  standings: PlayerStanding[];
  money: PlayerMoney[];
}

export interface Config {
  leagueName: string;
  commissioner: {
    name: string;
    paypal: string;
    venmo: string;
    zelle: string;
    cashNote: string;
  };
  scoring: {
    standardEntryFee: number;
    majorEntryFee: number;
    majors: string[];
  };
  currentSeason: number;
}

const dataDir = path.join(process.cwd(), "data");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function getConfig(): Config {
  return readJson<Config>(path.join(dataDir, "config.json"));
}

export function getPlayers(): Player[] {
  return readJson<Player[]>(path.join(dataDir, "players.json"));
}

export function getAvailableYears(): number[] {
  const seasonDir = path.join(dataDir, "seasons");
  if (!fs.existsSync(seasonDir)) return [];
  return fs
    .readdirSync(seasonDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parseInt(f.replace(".json", ""), 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => b - a); // newest first
}

export function getSeason(year: number): Season | null {
  const file = path.join(dataDir, "seasons", `${year}.json`);
  if (!fs.existsSync(file)) return null;
  return readJson<Season>(file);
}

export function getLatestSeason(): Season | null {
  const years = getAvailableYears();
  if (!years.length) return null;
  return getSeason(years[0]);
}
