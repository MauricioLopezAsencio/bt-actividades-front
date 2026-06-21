export interface WorkItemDto {
  id: number;
  workItemType: string;   // 'Epic' | 'Feature'
  state: string;
  title: string;
  iterationPath: string;
  minutosWorked: number | null;
}
