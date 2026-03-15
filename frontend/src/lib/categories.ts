// Category constants - Unit classification categories

export interface Category {
  id: number;
  name: string;
  code: string;
  color?: string;
}

export const CATEGORIES: Category[] = [
  { id: 0, name: "Recon", code: "Rec", color: "text-yellow-400" },
  { id: 1, name: "Infantry", code: "Inf", color: "text-green-400" },
  { id: 2, name: "Vehicle", code: "Veh", color: "text-blue-400" },
  { id: 3, name: "Support", code: "Sup", color: "text-purple-400" },
  { id: 5, name: "Helicopter", code: "Hel", color: "text-orange-400" },
  { id: 6, name: "Airplane", code: "Air", color: "text-red-400" },
  { id: 7, name: "Transport", code: "Tra", color: "text-gray-400" }
];

export function getCategoryById(id: number): Category {
  return CATEGORIES.find(category => category.id === id) || {
    id: 0,
    name: "Unknown",
    code: "Unk",
    color: "text-gray-500"
  };
} 