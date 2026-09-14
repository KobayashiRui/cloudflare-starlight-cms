export interface UpgradeChange {
  type: 'add' | 'update';
  file: string;
  content: Buffer;
}

export interface UpgradePlan {
  fromVersion: string;
  toVersion: string;
  changes: UpgradeChange[];
  conflicts: string[];
  dependenciesChanged: boolean;
}

export function templateFiles(templateRoot: string): Promise<Map<string, Buffer>>;
export function buildUpgradePlan(input: {
  projectRoot: string;
  oldTemplateRoot: string;
  targetTemplateRoot: string;
  fromVersion: string;
  toVersion: string;
}): Promise<UpgradePlan>;
export function applyUpgradePlan(projectRoot: string, plan: UpgradePlan): Promise<void>;
export function upgradeProject(input: {
  projectRoot: string;
  targetTemplateRoot: string;
  targetVersion: string;
  apply?: boolean;
}): Promise<UpgradePlan & { status: 'current' | 'conflict' | 'ready' | 'applied' }>;
