import { BlockchainManager } from "./blockchain";
import { CryptoUtils } from "./crypto-utils";
// Kita definisikan interface di sini jika file types global tidak tersedia/tidak terbaca
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

  /**
   * Implementasi Singleton pattern agar sesuai dengan route.ts:
   * const blockchain = BlockchainService.getInstance();
   */
  public static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  /**
   * Method utama yang dipanggil oleh route.ts.
   * Bertugas membuat transaksi, menambahkannya ke blockchain, dan melakukan mining
   * agar mendapatkan blockHash untuk disimpan di database.
   */
  public async addVoteToElection(
    electionId: number,
    voteData: { candidateId: number; timestamp: string }, // route.ts mengirim timestamp string
    voterPublicKey: string,
    signature: string
  ): Promise<{ hash: string; blockHash: string }> {
    
    // 1. Dapatkan instance blockchain untuk pemilu ini
    const blockchain = BlockchainManager.getBlockchain(electionId);

    // 2. Generate ID Vote yang unik
    const voteId = CryptoUtils.generateVoteId();

    // 3. Pastikan public key valid. Jika kosong (dari DB user belum ada), 
    // kita generate sementara agar tidak error di validasi blockchain (Opsional/Dev Mode)
    // PENTING: Di production, user HARUS sudah punya key pair yang valid.
    let finalPublicKey = voterPublicKey;
    if (!finalPublicKey || !CryptoUtils.isValidPublicKey(finalPublicKey)) {
        console.warn("Warning: Invalid or missing public key. Generating temporary key for transaction.");
        finalPublicKey = CryptoUtils.generateKeyPair().publicKey;
    }

    // 4. Susun objek transaksi sesuai format yang diminta Blockchain.ts
    // Note: Blockchain.ts mengharapkan timestamp berupa Date object, bukan string.
    const transaction: VoteTransaction = {
      voteId: voteId,
      electionId: electionId,
      candidateId: voteData.candidateId,
      voterPublicKey: finalPublicKey,
      timestamp: new Date(), // Gunakan waktu server saat ini
      signature: signature || "system-signed-placeholder", // Fallback jika signature kosong
    };

    // 5. Hitung hash transaksi untuk referensi (Transaction Hash)
    const txHash = CryptoUtils.hashVote(transaction);

    // 6. Tambahkan transaksi ke mempool (pending votes)
    const added = blockchain.addVoteTransaction(transaction);
    
    if (!added) {
      throw new Error("Failed to add vote transaction to blockchain validation pool.");
    }

    // 7. Force Mine block segera.
    // Karena route.ts membutuhkan 'blockHash' untuk disimpan ke database SQL (Prisma),
    // kita harus memaksa mining saat ini juga (Instant Finality untuk konteks ini).
    const minedBlock = blockchain.forceMinePendingVotes();

    if (!minedBlock) {
      throw new Error("Mining failed. Vote could not be confirmed in a block.");
    }

    // 8. Kembalikan data yang dibutuhkan route.ts
    return {
      hash: txHash,
      blockHash: minedBlock.hash,
    };
  }
}