import * as fs from 'fs';
import * as path from 'path';

interface DeploymentInfo {
  network: string;
  contractAddress: string;
  deployer: string;
  deploymentTime: string;
  blockNumber: number;
  gasUsed: string;
  configuration: {
    wmaticAddress: string;
    maxGasForExternalCall: number;
    emergencyWithdrawDelay: number;
    supportedTokens: Array<{
      address: string;
      symbol: string;
      decimals: number;
      maxStakeAmount: string;
    }>;
    protocols: Array<{
      name: string;
      contractAddress: string;
      rewardToken: string;
      protocolType: string;
      initialAPY: number;
      maxTVL: string;
      isVerified: boolean;
    }>;
  };
  verification: {
    verified: boolean;
    explorerUrl: string;
  };
}

export function getPolygonDeFiAddress(): string {
  try {
    const deploymentPath = path.join(
      process.cwd(),
      'deployInfo',
      'defi-polygon.json'
    );
    
    if (!fs.existsSync(deploymentPath)) {
      throw new Error('deployInfo/defi-polygon.json not found');
    }
    
    const deploymentData = fs.readFileSync(deploymentPath, 'utf8');
    const deploymentInfo: DeploymentInfo = JSON.parse(deploymentData);
    
    if (!deploymentInfo.contractAddress) {
      throw new Error('Contract address not found in deployment info');
    }
    
    return deploymentInfo.contractAddress;
  } catch (error) {
    console.error('Error reading PolygonDeFi address:', error);
    throw error;
  }
}

export function getDeploymentInfo(): DeploymentInfo {
  try {
    const deploymentPath = path.join(
      process.cwd(),
      'deployInfo',
      'defi-polygon.json'
    );
    
    if (!fs.existsSync(deploymentPath)) {
      throw new Error('deployInfo/defi-polygon.json not found');
    }
    
    const deploymentData = fs.readFileSync(deploymentPath, 'utf8');
    return JSON.parse(deploymentData);
  } catch (error) {
    console.error('Error reading deployment info:', error);
    throw error;
  }
}
