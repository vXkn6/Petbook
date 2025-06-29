export interface Pet {
  id?: string;
  name: string;
  nickname: string;
  age: number;
  species: string;
  breed: string;
  weight: number;
  chipId: string;
  photoLocalPath: string;
  photoUrl?: string;
  userId: string;
}

export interface Species {
  id?: string;
  name: string;
}

export interface Breed {
  id?: string;
  name: string;
  speciesId: string;
}