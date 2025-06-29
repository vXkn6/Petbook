export interface Veterinario {
  id?: string; // Opcional porque no lo tendrá al crear uno nuevo
  nombre: string;
  especialidad: string;
  foto: string;
  diasLaborales: string[] | { [key: string]: boolean };
  disponible: boolean;
}

export interface Especialidad {
  id?: string;
  nombre: string;
}