const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("P2P Energy Trading Marketplace - Complete Test Suite", function () {
  let userRegistry;
  let energyToken;
  let marketplace;
  let escrow;
  let rec;
  let deployer, producer1, producer2, consumer1, consumer2;

  beforeEach(async function () {
    // Get test accounts
    [deployer, producer1, producer2, consumer1, consumer2] =
      await ethers.getSigners();

    // Deploy contracts
    const UserRegistry = await ethers.getContractFactory("UserRegistry");
    userRegistry = await UserRegistry.deploy();

    const EnergyToken = await ethers.getContractFactory("EnergyToken");
    energyToken = await EnergyToken.deploy();

    const EscrowSettlement = await ethers.getContractFactory(
      "EscrowSettlement"
    );
    escrow = await EscrowSettlement.deploy();

    const EnergyMarketplace = await ethers.getContractFactory(
      "EnergyMarketplace"
    );
    marketplace = await EnergyMarketplace.deploy(
      await userRegistry.getAddress(),
      await energyToken.getAddress()
    );

    const RenewableEnergyCertificate = await ethers.getContractFactory(
      "RenewableEnergyCertificate"
    );
    rec = await RenewableEnergyCertificate.deploy();

    // Grant roles
    const MARKETPLACE_ROLE = ethers.keccak256(
      ethers.toUtf8Bytes("MARKETPLACE_ROLE")
    );
    const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const CERTIFICATE_ISSUER_ROLE = ethers.keccak256(
      ethers.toUtf8Bytes("CERTIFICATE_ISSUER_ROLE")
    );

    await escrow.grantRole(MARKETPLACE_ROLE, await marketplace.getAddress());
    await marketplace.grantRole(ORACLE_ROLE, deployer.address);
    await energyToken.grantRole(MINTER_ROLE, deployer.address);
    await rec.grantRole(CERTIFICATE_ISSUER_ROLE, deployer.address);
  });

  describe("UserRegistry Tests", function () {
    it("Should register a new producer", async function () {
      await userRegistry.registerUser(
        producer1.address,
        "Producer 1",
        true,
        false,
        "Solar Farm - Location A"
      );

      const user = await userRegistry.getUser(producer1.address);
      expect(user.isProducer).to.be.true;
      expect(user.isConsumer).to.be.false;
      expect(user.name).to.equal("Producer 1");
    });

    it("Should register a new consumer", async function () {
      await userRegistry.registerUser(
        consumer1.address,
        "Consumer 1",
        false,
        true,
        "Residential User"
      );

      const user = await userRegistry.getUser(consumer1.address);
      expect(user.isProducer).to.be.false;
      expect(user.isConsumer).to.be.true;
    });

    it("Should not allow duplicate registration", async function () {
      await userRegistry.registerUser(
        producer1.address,
        "Producer 1",
        true,
        false,
        "Data"
      );

      await expect(
        userRegistry.registerUser(
          producer1.address,
          "Producer 1",
          true,
          false,
          "Data"
        )
      ).to.be.revertedWith("User already registered");
    });

    it("Should update user roles", async function () {
      await userRegistry.registerUser(
        producer1.address,
        "User",
        true,
        false,
        "Data"
      );

      await userRegistry.updateUserRole(producer1.address, true, true);

      const user = await userRegistry.getUser(producer1.address);
      expect(user.isProducer).to.be.true;
      expect(user.isConsumer).to.be.true;
    });

    it("Should deactivate a user", async function () {
      await userRegistry.registerUser(
        producer1.address,
        "User",
        true,
        false,
        "Data"
      );

      await userRegistry.setUserStatus(producer1.address, false);

      const isActive = await userRegistry.isUserActive(producer1.address);
      expect(isActive).to.be.false;
    });
  });

  describe("EnergyToken Tests", function () {
    it("Should mint energy tokens", async function () {
      await energyToken.mintEnergy(producer1.address, 100);

      const balance = await energyToken.balanceOf(producer1.address);
      expect(balance).to.equal(100);
    });

    it("Should not allow non-minter to mint", async function () {
      await expect(
        energyToken.connect(producer1).mintEnergy(producer1.address, 100)
      ).to.be.revertedWithCustomError(energyToken, "AccessControlUnauthorizedAccount");
    });

    it("Should allow users to burn their tokens", async function () {
      await energyToken.mintEnergy(producer1.address, 100);

      await energyToken.connect(producer1).burn(50);

      const balance = await energyToken.balanceOf(producer1.address);
      expect(balance).to.equal(50);
    });

    it("Should track total energy minted", async function () {
      await energyToken.mintEnergy(producer1.address, 100);
      await energyToken.mintEnergy(producer2.address, 50);

      const total = await energyToken.getTotalEnergyMinted();
      expect(total).to.equal(150);
    });
  });

  describe("EnergyMarketplace Tests", function () {
    beforeEach(async function () {
      // Register users
      await userRegistry.registerUser(
        producer1.address,
        "Producer 1",
        true,
        false,
        "Solar Farm"
      );
      await userRegistry.registerUser(
        consumer1.address,
        "Consumer 1",
        false,
        true,
        "Home"
      );

      // Mint energy to producer
      await energyToken.mintEnergy(producer1.address, 100);
    });

    it("Should create an energy offer", async function () {
      await marketplace.connect(producer1).createOffer(50, ethers.parseEther("1"));

      const offer = await marketplace.getOffer(1);
      expect(offer.producer).to.equal(producer1.address);
      expect(offer.energyAmount).to.equal(50);
    });

    it("Should not allow non-producer to create offer", async function () {
      await expect(
        marketplace.connect(consumer1).createOffer(50, ethers.parseEther("1"))
      ).to.be.revertedWith("Only producers can create offers");
    });

    it("Should not allow offer creation with insufficient balance", async function () {
      await expect(
        marketplace.connect(producer1).createOffer(200, ethers.parseEther("1"))
      ).to.be.revertedWith("Insufficient energy balance");
    });

    it("Should accept an offer and create trade", async function () {
      await marketplace.connect(producer1).createOffer(50, ethers.parseEther("1"));

      const paymentAmount = ethers.parseEther("50");
      await marketplace
        .connect(consumer1)
        .acceptOffer(1, { value: paymentAmount });

      const trade = await marketplace.getTrade(1);
      expect(trade.consumer).to.equal(consumer1.address);
      expect(trade.producer).to.equal(producer1.address);
    });

    it("Should not allow consumer to create offers", async function () {
      await expect(
        marketplace.connect(consumer1).createOffer(50, ethers.parseEther("1"))
      ).to.be.revertedWith("Only producers can create offers");
    });

    it("Should cancel an active offer", async function () {
      await marketplace.connect(producer1).createOffer(50, ethers.parseEther("1"));

      await marketplace.connect(producer1).cancelOffer(1);

      const offer = await marketplace.getOffer(1);
      expect(offer.status).to.equal(2); // CANCELLED status
    });
  });

  describe("RenewableEnergyCertificate Tests", function () {
    beforeEach(async function () {
      // Register producer
      await userRegistry.registerUser(
        producer1.address,
        "Producer 1",
        true,
        false,
        "Solar Farm"
      );
    });

    it("Should issue a renewable energy certificate", async function () {
      // EnergySource.SOLAR = 0
      const certId = await rec.issueCertificate.staticCall(
        producer1.address,
        0, // SOLAR
        100,
        '{"location": "California", "capacity": "1MW"}'
      );

      await rec.issueCertificate(
        producer1.address,
        0,
        100,
        '{"location": "California", "capacity": "1MW"}'
      );

      const cert = await rec.getCertificate(1);
      expect(cert.producer).to.equal(producer1.address);
      expect(cert.energyAmount).to.equal(100);
      expect(cert.isValid).to.be.true;
    });

    it("Should verify certificate validity", async function () {
      const certId = await rec.issueCertificate.staticCall(
        producer1.address,
        0,
        100,
        "metadata"
      );
      await rec.issueCertificate(producer1.address, 0, 100, "metadata");

      const isValid = await rec.isCertificateValid(1);
      expect(isValid).to.be.true;
    });

    it("Should revoke a certificate", async function () {
      await rec.issueCertificate(producer1.address, 0, 100, "metadata");

      await rec.revokeCertificate(1);

      const isValid = await rec.isCertificateValid(1);
      expect(isValid).to.be.false;
    });

    it("Should track energy by source", async function () {
      await rec.issueCertificate(producer1.address, 0, 100, "metadata");
      await rec.issueCertificate(producer1.address, 1, 50, "metadata"); // WIND = 1

      const solarTotal = await rec.getTotalEnergyBySource(0);
      const windTotal = await rec.getTotalEnergyBySource(1);

      expect(solarTotal).to.equal(100);
      expect(windTotal).to.equal(50);
    });
  });

  describe("EscrowSettlement Tests", function () {
    beforeEach(async function () {
      // Setup users
      await userRegistry.registerUser(
        producer1.address,
        "Producer",
        true,
        false,
        "Data"
      );
      await userRegistry.registerUser(
        consumer1.address,
        "Consumer",
        false,
        true,
        "Data"
      );

      // Mint energy
      await energyToken.mintEnergy(producer1.address, 100);
    });

    it("Should create an escrow record", async function () {
      const tradeId = 1;
      const amount = ethers.parseEther("50");

      // Grant marketplace role
      const MARKETPLACE_ROLE = ethers.keccak256(
        ethers.toUtf8Bytes("MARKETPLACE_ROLE")
      );
      await escrow.grantRole(MARKETPLACE_ROLE, deployer.address);

      await escrow.createEscrow(
        tradeId,
        consumer1.address,
        producer1.address,
        amount,
        { value: amount }
      );

      const escrowRecord = await escrow.getEscrow(1);
      expect(escrowRecord.buyer).to.equal(consumer1.address);
      expect(escrowRecord.seller).to.equal(producer1.address);
    });

    it("Should confirm delivery", async function () {
      const tradeId = 1;
      const amount = ethers.parseEther("50");

      const MARKETPLACE_ROLE = ethers.keccak256(
        ethers.toUtf8Bytes("MARKETPLACE_ROLE")
      );
      await escrow.grantRole(MARKETPLACE_ROLE, deployer.address);

      await escrow.createEscrow(
        tradeId,
        consumer1.address,
        producer1.address,
        amount,
        { value: amount }
      );

      await escrow.confirmDeliveryByOracle(1);

      const escrowRecord = await escrow.getEscrow(1);
      expect(escrowRecord.status).to.equal(1); // CONFIRMED
    });
  });

  describe("Complete Trade Flow Tests", function () {
    beforeEach(async function () {
      // Register users
      await userRegistry.registerUser(
        producer1.address,
        "Producer 1",
        true,
        false,
        "Solar Farm"
      );
      await userRegistry.registerUser(
        consumer1.address,
        "Consumer 1",
        false,
        true,
        "Home"
      );

      // Mint energy
      await energyToken.mintEnergy(producer1.address, 100);

      // Approve marketplace to transfer tokens
      await energyToken
        .connect(producer1)
        .approve(await marketplace.getAddress(), 100);
    });

    it("Should complete a full trade flow", async function () {
      // Step 1: Producer creates offer
      await marketplace.connect(producer1).createOffer(50, ethers.parseEther("1"));

      // Step 2: Consumer accepts offer
      const paymentAmount = ethers.parseEther("50");
      const acceptTx = await marketplace
        .connect(consumer1)
        .acceptOffer(1, { value: paymentAmount });

      expect(acceptTx).to.emit(marketplace, "OfferAccepted");

      // Step 3: Oracle confirms delivery
      await marketplace.confirmDelivery(1);

      // Step 4: Oracle settles trade
      const settleTx = await marketplace.settleTrade(1);
      expect(settleTx).to.emit(marketplace, "TradeSettled");

      // Verify trade is settled
      const trade = await marketplace.getTrade(1);
      expect(trade.settled).to.be.true;
    });
  });

  describe("Reentrancy and Security Tests", function () {
    it("Should prevent reentrancy in marketplace", async function () {
      // This test would require a malicious contract that attempts reentrancy
      // The ReentrancyGuard should prevent this
      // Implementation depends on specific attack vector
    });

    it("Should only allow authorized addresses for oracle functions", async function () {
      // Non-oracle cannot call confirmDelivery
      await expect(
        marketplace.connect(producer1).confirmDelivery(1)
      ).to.be.revertedWithCustomError(marketplace, "AccessControlUnauthorizedAccount");
    });
  });
});
