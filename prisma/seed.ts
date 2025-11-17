import { PrismaClient, ConfigType } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  try {
    // Clean existing data first
    console.log("🧹 Cleaning existing data...");
    await prisma.userElectionParticipation.deleteMany();

    await prisma.vote.deleteMany();
    await prisma.blockchainBlock.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.electionStatistics.deleteMany();
    await prisma.systemStatistics.deleteMany();
    await prisma.electionVoter.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.election.deleteMany();
    await prisma.emailLog.deleteMany();
    await prisma.systemConfig.deleteMany();
    await prisma.user.deleteMany();
    console.log("✅ Database cleaned");

    // Create admin user
    const adminPassword = await bcrypt.hash("admin123!", 12);
    const admin = await prisma.user.create({
      data: {
        studentId: "ADMIN001",
        username: "admin",
        email: "admin@blockvote.com",
        fullName: "System Administrator",
        passwordHash: adminPassword,
        role: "ADMIN",
        status: "ACTIVE",
        emailVerified: true,
        lastLoginAt: new Date(),
      },
    });
    console.log("✅ Admin user created:", admin.email);

    // Create organization users
    const orgPassword = await bcrypt.hash("org123!", 12);
    const organizations = [];

    const org1 = await prisma.user.create({
      data: {
        studentId: "ORG001",
        username: "university-council",
        email: "council@university.edu",
        fullName: "University Student Council",
        passwordHash: orgPassword,
        role: "ORGANIZATION",
        status: "ACTIVE",
        emailVerified: true,
        lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
    });
    organizations.push(org1);

    const org2 = await prisma.user.create({
      data: {
        studentId: "ORG002",
        username: "computer-science-dept",
        email: "cs-dept@university.edu",
        fullName: "Computer Science Department",
        passwordHash: orgPassword,
        role: "ORGANIZATION",
        status: "ACTIVE",
        emailVerified: true,
      },
    });
    organizations.push(org2);

    console.log("✅ Organization users created:", organizations.length);

    // Create voter users with realistic data
    const voterPassword = await bcrypt.hash("voter123!", 12);
    const voters = [];

    const voterData = [
      {
        studentId: "STU2024001",
        username: "alice.johnson",
        email: "alice.johnson@student.edu",
        fullName: "Alice Johnson",
      },
      {
        studentId: "STU2024002",
        username: "bob.smith",
        email: "bob.smith@student.edu",
        fullName: "Bob Smith",
      },
      {
        studentId: "STU2024003",
        username: "carol.davis",
        email: "carol.davis@student.edu",
        fullName: "Carol Davis",
      },
      {
        studentId: "STU2024004",
        username: "david.wilson",
        email: "david.wilson@student.edu",
        fullName: "David Wilson",
      },
      {
        studentId: "STU2024005",
        username: "emma.brown",
        email: "emma.brown@student.edu",
        fullName: "Emma Brown",
      },
      {
        studentId: "STU2024006",
        username: "frank.miller",
        email: "frank.miller@student.edu",
        fullName: "Frank Miller",
      },
      {
        studentId: "STU2024007",
        username: "grace.taylor",
        email: "grace.taylor@student.edu",
        fullName: "Grace Taylor",
      },
      {
        studentId: "STU2024008",
        username: "henry.anderson",
        email: "henry.anderson@student.edu",
        fullName: "Henry Anderson",
      },
    ];

    for (const voterInfo of voterData) {
      const voter = await prisma.user.create({
        data: {
          studentId: voterInfo.studentId,
          username: voterInfo.username,
          email: voterInfo.email,
          fullName: voterInfo.fullName,
          passwordHash: voterPassword,
          role: "VOTER",
          status: "ACTIVE",
          emailVerified: Math.random() > 0.3, // 70% have verified emails
          lastLoginAt:
            Math.random() > 0.5
              ? new Date(
                  Date.now() -
                    Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
                )
              : undefined,
        },
      });
      voters.push(voter);
    }
    console.log("✅ Voter users created:", voters.length);

    // Create sample elections
    const elections = [];

    // Active election
    const activeElection = await prisma.election.create({
      data: {
        title: "Student Council President Election 2024",
        description:
          "Annual election for the student council president position. This election will determine the leadership for the upcoming academic year.",
        organizationId: org1.id,
        status: "ACTIVE",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Started yesterday
        endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // Ends in 6 days
      },
    });
    elections.push(activeElection);

    // Draft election
    const draftElection1 = await prisma.election.create({
      data: {
        title: "Computer Science Department Representative Election",
        description:
          "Election for department representative to the academic board.",
        organizationId: org2.id,
        status: "DRAFT",
        startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Starts in 2 weeks
        endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // Ends in 3 weeks
      },
    });
    const draftElection2 = await prisma.election.create({
      data: {
        title: "Spring Semester Project Funding Vote",
        description:
          "Students vote on which projects get funding for Spring 2026.",
        organizationId: org2.id,
        status: "DRAFT",
        startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Starts in 2 weeks
        endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // Ends in 3 weeks
      },
    });
    elections.push(draftElection1,draftElection2);

    // Ended election
    const endedElection = await prisma.election.create({
      data: {
        title: "Library Committee Election 2024",
        description:
          "Election for student representatives on the library advisory committee.",
        organizationId: org1.id,
        status: "ENDED",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Started 30 days ago
        endDate: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000), // Ended 23 days ago
      }
    });
    elections.push(endedElection);

    console.log("✅ Sample elections created:", elections.length);

    // Create candidates for active election
    const activeCandidates = await Promise.all([
      prisma.candidate.create({
        data: {
          electionId: activeElection.id,
          name: "Sarah Thompson",
          description:
            "Experienced leader with focus on student welfare, campus sustainability, and academic excellence. Former class representative with proven track record.",
        },
      }),
      prisma.candidate.create({
        data: {
          electionId: activeElection.id,
          name: "Michael Chen",
          description:
            "Advocate for better campus facilities, student engagement activities, and mental health support programs. Computer Science major with leadership experience.",
        },
      }),
      prisma.candidate.create({
        data: {
          electionId: activeElection.id,
          name: "Jessica Rodriguez",
          description:
            "Champion of diversity initiatives, digital innovation in education, and improved student services. Business Administration major with student government experience.",
        },
      }),
    ]);

    // Create candidates for draft election
    const draftCandidates = await Promise.all([
      prisma.candidate.create({
        data: {
          electionId: draftElection1.id,
          name: "Alex Kumar",
          description:
            "PhD candidate focused on improving graduate student representation and research opportunities.",
        },
      }),
      prisma.candidate.create({
        data: {
          electionId: draftElection1.id,
          name: "Lisa Wang",
          description:
            "Senior undergraduate with experience in curriculum committee and student mentoring programs.",
        },
      }),
      prisma.candidate.create({
        data: {
          electionId: draftElection2.id,
          name: "Bambang",
          description:
            "Senior undergraduate with experience in curriculum committee and student mentoring programs.",
        },
      }),
      prisma.candidate.create({
        data: {
          electionId: draftElection2.id,
          name: "Alex",
          description:
            "PhD candidate focused on improving graduate student representation and research opportunities.",
        },
      }),
    ]);

    // Create candidates for ended election
    const endedCandidates = await Promise.all([
      prisma.candidate.create({
        data: {
          electionId: endedElection.id,
          name: "Thomas Green",
          description:
            "Library science enthusiast with focus on digital resources and study spaces.",
        },
      }),
      prisma.candidate.create({
        data: {
          electionId: endedElection.id,
          name: "Maria Santos",
          description:
            "Graduate student advocate for extended library hours and research support.",
        },
      }),
    ]);

    console.log(
      "✅ Candidates created:",
      activeCandidates.length + draftCandidates.length + endedCandidates.length,
    );

    // Create UserElectionParticipation records (invitations and participation tracking)
    const participations = [];

    // Active election - invite all voters, some accepted, some declined, some pending
    for (let i = 0; i < voters.length; i++) {
      const voter = voters[i];
      let inviteStatus: "PENDING" | "ACCEPTED" | "DECLINED" = "PENDING";
      let respondedAt: Date | undefined = undefined;
      let votedAt: Date | undefined = undefined;
      let hasVoted = false;

      if (i < 3) {
        // First 3 voters have voted
        inviteStatus = "ACCEPTED";
        respondedAt = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
        votedAt = new Date(Date.now() - (5 - i) * 24 * 60 * 60 * 1000);
        hasVoted = true;
      } else if (i < 5) {
        // Next 2 voters accepted but haven't voted yet
        inviteStatus = "ACCEPTED";
        respondedAt = new Date(Date.now() - (4 - i) * 24 * 60 * 60 * 1000);
      } else if (i < 6) {
        // One voter declined
        inviteStatus = "DECLINED";
        respondedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      }
      // Remaining voters are still pending

      const participation = await prisma.userElectionParticipation.create({
        data: {
          userId: voter.id,
          electionId: activeElection.id,
          inviteStatus: inviteStatus,
          hasVoted: hasVoted,
          invitedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Invited a week ago
          respondedAt: respondedAt,
          votedAt: votedAt,
          notificationSent: true,
        },
      });
      participations.push(participation);
    }

    // Ended election - all invited, most participated
    for (let i = 0; i < Math.min(voters.length, 6); i++) {
      const voter = voters[i];
      const hasVoted = i < 5; // 5 out of 6 voted

      const participation = await prisma.userElectionParticipation.create({
        data: {
          userId: voter.id,
          electionId: endedElection.id,
          inviteStatus: "ACCEPTED",
          hasVoted: hasVoted,
          invitedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
          respondedAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000),
          votedAt: hasVoted
            ? new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000)
            : undefined,
          notificationSent: true,
        },
      });
      participations.push(participation);
    }

    console.log(
      "✅ User election participations created:",
      participations.length,
    );

    // Create some votes for the ended election with proper candidate tracking
    const votesData = [];
    const voteTransactions = [];

    for (let i = 0; i < 5; i++) {
      const voter = voters[i];
      const candidateIndex = i % 2; // Alternate between first two candidates
      const candidate = endedCandidates[candidateIndex];
      const transactionHash = `tx_hash_${i + 1}_${Date.now()}`;
      const blockHash = `block_hash_${i + 1}_${Date.now()}`;

      // Create vote transaction for blockchain
      const voteTransaction = {
        voteId: `vote_${endedElection.id}_${voter.id}`,
        electionId: endedElection.id,
        voterPublicKey: `voter_public_key_${voter.id}`,
        candidateId: candidate.id,
        timestamp: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000),
        signature: `signature_${i + 1}_${Date.now()}`,
      };
      voteTransactions.push(voteTransaction);

      // Create vote record in database
      const vote = await prisma.vote.create({
        data: {
          electionId: endedElection.id,
          voterId: voter.id,
          blockHash: blockHash,
          transactionHash: transactionHash,
          votedAt: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000),
        },
      });
      votesData.push(vote);
    }

    // Create blockchain block containing the vote transactions
    await prisma.blockchainBlock.create({
      data: {
        blockIndex: 1,
        previousHash: "genesis_block_hash",
        merkleRoot: "merkle_root_" + Date.now(),
        timestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        electionId: endedElection.id,
        nonce: 12345,
        hash: "block_hash_" + Date.now(),
        votesData: JSON.stringify(voteTransactions),
      },
    });

    console.log("✅ Sample votes created:", votesData.length);
    console.log("✅ Blockchain block created with vote transactions");

    // Create election statistics
    await prisma.electionStatistics.create({
      data: {
        electionId: activeElection.id,
        totalRegisteredVoters: voters.length,
        totalVotesCast: 3,
        participationRate: 3 / voters.length,
        votingStarted: activeElection.startDate,
        lastVoteTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        averageVotingTime: 2.5,
      },
    });

    await prisma.electionStatistics.create({
      data: {
        electionId: endedElection.id,
        totalRegisteredVoters: 6,
        totalVotesCast: 5,
        participationRate: 5 / 6,
        votingStarted: endedElection.startDate,
        lastVoteTime: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        averageVotingTime: 1.8,
      },
    });

    console.log("✅ Election statistics created");

    // Create system configuration
    const systemConfigs: Array<{
      key: string;
      value: string;
      type: ConfigType;
    }> = [
      { key: "BLOCKCHAIN_DIFFICULTY", value: "4", type: "NUMBER" },
      { key: "MAX_VOTES_PER_BLOCK", value: "100", type: "NUMBER" },
      { key: "PROOF_OF_WORK_ENABLED", value: "true", type: "BOOLEAN" },
      { key: "EMAIL_NOTIFICATIONS_ENABLED", value: "true", type: "BOOLEAN" },
      { key: "SYSTEM_MAINTENANCE_MODE", value: "false", type: "BOOLEAN" },
      { key: "DEFAULT_ELECTION_DURATION_DAYS", value: "7", type: "NUMBER" },
      { key: "MIN_CANDIDATES_PER_ELECTION", value: "2", type: "NUMBER" },
      { key: "MAX_CANDIDATES_PER_ELECTION", value: "10", type: "NUMBER" },
      { key: "VOTER_INVITATION_EXPIRY_DAYS", value: "30", type: "NUMBER" },
      { key: "EMAIL_VERIFICATION_REQUIRED", value: "true", type: "BOOLEAN" },
      { key: "MAX_VOTERS_PER_ELECTION", value: "1000", type: "NUMBER" },
    ];

    for (const config of systemConfigs) {
      await prisma.systemConfig.create({
        data: {
          key: config.key,
          value: config.value,
          type: config.type,
        },
      });
    }
    console.log(
      "✅ System configuration created:",
      systemConfigs.length,
      "entries",
    );

    // Initialize system statistics
    await prisma.systemStatistics.create({
      data: {
        totalUsers: await prisma.user.count(),
        totalElections: await prisma.election.count(),
        totalVotes: await prisma.vote.count(),
        totalBlocks: await prisma.blockchainBlock.count(), // FIX: Hitung blok yang sebenarnya
        averageBlockTime: 0,
        systemUptime: 0,
      },
    });
    console.log("✅ System statistics initialized");

    // Create pending organization registrations (for admin approval workflow demonstration)
    const pendingOrgPassword = await bcrypt.hash("PendingOrg123!", 12);
    
    const pendingOrg1Data = {
      organizationName: "Engineering Department",
      contactEmail: "engineering@university.edu",
      contactName: "Dr. Emily Chen",
      phone: "+1-555-0102",
      website: "https://engineering.university.edu",
      description: "Engineering Department for conducting departmental elections and votes on curriculum changes.",
      address: {
        street: "200 Engineering Building",
        city: "University City",
        state: "CA",
        zipCode: "90210",
        country: "USA",
      },
      username: "engineering-dept",
      passwordHash: pendingOrgPassword,
      status: "pending_approval",
      submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      ipAddress: "10.0.5.42",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    };

    const pendingOrg2Data = {
      organizationName: "Business School Student Association",
      contactEmail: "bssa@university.edu",
      contactName: "Michael Rodriguez",
      phone: "+1-555-0103",
      website: "https://business.university.edu/bssa",
      description: "Student association representing business school students for elections and governance.",
      address: {
        street: "150 Business Hall",
        city: "University City",
        state: "CA",
        zipCode: "90210",
        country: "USA",
      },
      username: "business-student-assoc",
      passwordHash: pendingOrgPassword,
      status: "pending_approval",
      submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      ipAddress: "10.0.5.88",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    };

    await prisma.systemConfig.createMany({
      data: [
        {
          key: `org_registration_${crypto.randomUUID().split('-')[0]}`,
          value: JSON.stringify(pendingOrg1Data),
          type: "JSON",
        },
        {
          key: `org_registration_${crypto.randomUUID().split('-')[0]}`,
          value: JSON.stringify(pendingOrg2Data),
          type: "JSON",
        },
      ],
    });
    console.log("✅ Pending organization registrations created: 2");

    // Create comprehensive audit logs
    const auditLogs = [
      {
        userId: admin.id,
        action: "LOGIN",
        resource: "USER",
        resourceId: admin.id,
        details: "Admin user logged in during system setup",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0 (Seeding Script)",
      },
      {
        userId: org1.id,
        action: "CREATE",
        resource: "ELECTION",
        resourceId: activeElection.id,
        details: `Created new election: ${activeElection.title}`,
        ipAddress: "10.0.0.15",
        userAgent: "Mozilla/5.0 (Admin Dashboard)",
      },
      {
        userId: org2.id,
        action: "CREATE",
        resource: "ELECTION",
        resourceId: draftElection1.id, // FIX: Referensi ke draftElection1
        details: `Created draft election: ${draftElection1.title}`, // FIX: Referensi ke draftElection1
        ipAddress: "10.0.0.22",
        userAgent: "Mozilla/5.0 (Admin Dashboard)",
      },
      {
        userId: admin.id,
        action: "UPDATE",
        resource: "ELECTION",
        resourceId: activeElection.id,
        details: "Activated election and sent voter invitations",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0 (Admin Dashboard)",
      },
      {
        userId: voters[0].id,
        action: "VOTE",
        resource: "ELECTION",
        resourceId: endedElection.id,
        details: "Cast vote in ended election",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 (Voter Portal)",
      },
      {
        userId: admin.id,
        action: "VIEW",
        resource: "STATISTICS",
        details: "Viewed system statistics dashboard",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0 (Admin Dashboard)",
      },
    ];

    for (const log of auditLogs) {
      await prisma.auditLog.create({ data: log });
    }
    console.log("✅ Audit logs created:", auditLogs.length);

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n📋 Summary:");
    console.log(
      `👤 Users created: ${voters.length + organizations.length + 1} (1 admin, ${organizations.length} organizations, ${voters.length} voters)`,
    );
    console.log(
      `🗳️  Elections created: ${elections.length} (1 active, 2 draft, 1 ended)`, // FIX: Perbarui jumlah draf
    );
    console.log(
      `🏃‍♂️ Candidates created: ${activeCandidates.length + draftCandidates.length + endedCandidates.length}`,
    );
    console.log(`📨 Election participations: ${participations.length}`);
    console.log(
      `🗳️  Votes cast: ${votesData.length} (with candidate choices recorded)`,
    );
    console.log(`⚙️  System configs: ${systemConfigs.length}`);
    console.log(`🏢 Pending organization registrations: 2 (awaiting admin approval)`);
    console.log(
      `🔗 Blockchain blocks: 1 (with ${voteTransactions.length} vote transactions)`,
    );
    console.log(`📊 Statistics records: 3 (1 system, 2 election)`);
    console.log(`📝 Audit logs: ${auditLogs.length}`);

    console.log("\n🔑 Default login credentials:");
    console.log("Admin: admin@blockvote.com / admin123!");
    console.log("Organizations:");
    console.log("  - council@university.edu / org123!");
    console.log("  - cs-dept@university.edu / org123!");
    console.log("Voters: alice.johnson@student.edu / voter123! (and others)");

    console.log("\n📊 Election Status:");
    console.log(
      `Active Election: "${activeElection.title}" (3 votes cast, 2 pending invites)`, // FIX: Klarifikasi jumlah pending
    );
    console.log(`Draft Election: "${draftElection1.title}" (not yet started)`); // FIX: Referensi ke draftElection1
    console.log(
      `Ended Election: "${endedElection.title}" (5/6 voters participated)`,
    );

    // Show vote distribution
    const candidate1Votes = voteTransactions.filter(
      (vt) => vt.candidateId === endedCandidates[0].id,
    ).length;
    const candidate2Votes = voteTransactions.filter(
      (vt) => vt.candidateId === endedCandidates[1].id,
    ).length;
    console.log(`\n📊 Vote Results for "${endedElection.title}":`);
    console.log(`  - ${endedCandidates[0].name}: ${candidate1Votes} votes`);
    console.log(`  - ${endedCandidates[1].name}: ${candidate2Votes} votes`);
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });