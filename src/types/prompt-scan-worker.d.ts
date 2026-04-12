declare module '@dcyfr/ai/security/prompt-scan-worker' {
  export interface PromptScanInput {
    scanId: string;
    prompt: string;
    context?: string;
    options?: unknown;
  }

  export interface PromptScanHooks {
    onStateChange?: (state: string, attempt: number) => void;
  }

  export interface PromptScanFinding {
    pattern: string;
    category: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    confidence: number;
    source: 'iopc' | 'taxonomy' | 'pattern';
    details?: string | null;
  }

  export interface PromptScanOutput {
    findings: PromptScanFinding[];
    riskScore: number;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'safe';
    safe: boolean;
    remediationSummary: string | null;
    attempts: number;
  }

  export type PromptScanResult =
    | {
      success: true;
      output: PromptScanOutput;
    }
    | {
      success: false;
      error: string;
      finalAttempt: number;
    };

  export function executePromptScan(
    input: PromptScanInput,
    hooks?: PromptScanHooks,
  ): Promise<PromptScanResult>;
}
