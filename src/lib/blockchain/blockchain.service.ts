import { BlockchainManager } from "./blockchain";
import { CryptoUtils } from "./crypto-utils";

// Define interface locally if types are not available globally
export interface VoteTransaction {
  voteId: string;
  electionId: number;
  voterPublicKey: string;
  candidateId: number;
  timestamp: Date;
  signature: string;
}

export class BlockchainService {
  private static instance: BlockchainService;

  private constructor() {}

  public static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  /**
   * Adds a vote to the blockchain.
   * If the voter lacks a key, it generates a temporary key pair and SIGNS the vote.
   */
  public async addVoteToElection(
    electionId: number,
    voteData: { candidateId: number; timestamp: string },
    voterPublicKey: string,
    signature: string
  ): Promise<{ hash: string; blockHash: string }> {
    
    // 1. Get Blockchain Instance
    const blockchain = BlockchainManager.getBlockchain(electionId);

    // 2. Generate IDs and Timestamp
    const voteId = CryptoUtils.generateVoteId();
    // Use a single timestamp variable to ensure consistency between signature and transaction
    const timestamp = new Date(); 

    // 3. Handle Keys and Signing
    let finalPublicKey = voterPublicKey;
    let finalSignature = signature;

    // Check if public key is missing or invalid
    if (!finalPublicKey || !CryptoUtils.isValidPublicKey(finalPublicKey)) {
        console.log("Generating temporary RSA keypair for vote...");
        
        // Generate valid RSA Keypair using your CryptoUtils
        const keyPair = CryptoUtils.generateKeyPair();
        finalPublicKey = keyPair.publicKey;

        // CRITICAL STEP: We must sign the data exactly as the Blockchain will verify it.
        // The Blockchain calls CryptoUtils.canonicalSerializeVote inside validateVoteSignature
        const voteToSign = {
            voteId: voteId,
            electionId: electionId,
            voterPublicKey: finalPublicKey,
            candidateId: voteData.candidateId,
            timestamp: timestamp
        };

        // Serialize the data using the canonical format
        const serializedData = CryptoUtils.canonicalSerializeVote(voteToSign);

        // Sign the data using the temporary private key
        finalSignature = CryptoUtils.signData(serializedData, keyPair.privateKey);
    }

    // 4. Construct the Transaction
    const transaction: VoteTransaction = {
      voteId: voteId,
      electionId: electionId,
      candidateId: voteData.candidateId,
      voterPublicKey: finalPublicKey,
      timestamp: timestamp,
      signature: finalSignature, 
    };

    // 5. Calculate Transaction Hash (for reference)
    const txHash = CryptoUtils.hashVote(transaction);

    // 6. Add to Blockchain (Validation happens inside here)
    // This calls BlockchainSecurity.validateVoteSignature(vote)
    const added = blockchain.addVoteTransaction(transaction);
    
    if (!added) {
      throw new Error("Failed to add vote. Signature validation failed or voter already voted.");
    }

    // 7. Force Mine (Instant Finality for this use case)
    const minedBlock = blockchain.forceMinePendingVotes();

    if (!minedBlock) {
      throw new Error("Mining failed. Vote could not be confirmed in a block.");
    }

    // 8. Return Result
    return {
      hash: txHash,
      blockHash: minedBlock.hash,
    };
  }
}