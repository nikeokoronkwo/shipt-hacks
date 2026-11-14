// Fictional Birmingham fixtures for UI testing, not real facilities or availability.
export type Shelter = {
  id: number; name: string; address: string; neighborhood: string; beds: number;
  distance: number; audience: string; tags: string[]; intake: string;
  coordinates: [number, number];
};
export const BIRMINGHAM_CENTER: [number, number] = [-86.8025, 33.5207];
export const shelters: Shelter[] = [
  { id: 1, name: "Downtown Community Shelter", address: "Downtown, Birmingham, AL", neighborhood: "Downtown", beds: 12, distance: 1.2, audience: "Men and women", tags: ["ADA Accessible", "Meals"], intake: "2:00 PM – 8:00 PM daily", coordinates: [-86.809, 33.516] },
  { id: 2, name: "Northside Welcome Center", address: "Northside, Birmingham, AL", neighborhood: "Northside", beds: 8, distance: 1.8, audience: "Men only", tags: ["ADA Accessible", "Meals"], intake: "4:00 PM – 9:00 PM daily", coordinates: [-86.815, 33.531] },
  { id: 3, name: "Southside Community House", address: "Southside, Birmingham, AL", neighborhood: "Southside", beds: 5, distance: 2.5, audience: "Women only", tags: ["Women Only", "Meals"], intake: "3:00 PM – 8:00 PM daily", coordinates: [-86.797, 33.501] },
  { id: 4, name: "Avondale Family Shelter", address: "Avondale, Birmingham, AL", neighborhood: "Avondale", beds: 15, distance: 4.1, audience: "All genders", tags: ["Pet Friendly", "Family Units", "ADA Accessible"], intake: "Call ahead for intake", coordinates: [-86.774, 33.525] },
  { id: 5, name: "Eastside Safe Rest", address: "East Lake, Birmingham, AL", neighborhood: "East Lake", beds: 0, distance: 5.9, audience: "Waitlist open", tags: ["Pet Friendly"], intake: "Call ahead for intake", coordinates: [-86.747, 33.556] },
];
export const filters = ["All Beds", "Pet Friendly", "ADA Accessible", "Women Only", "Family Units"];
