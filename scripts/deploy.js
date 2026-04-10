const hre = require("hardhat");

async function main() {
  console.log("Starting P2P Energy Trading Marketplace deployment...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}\n`);

  // 1. Deploy UserRegistry
  console.log("1. Deploying UserRegistry...");
  const UserRegistry = await hre.ethers.getContractFactory("UserRegistry");
  const userRegistry = await UserRegistry.deploy();
  await userRegistry.waitForDeployment();
  const userRegistryAddress = await userRegistry.getAddress();
  console.log(`   UserRegistry deployed to: ${userRegistryAddress}\n`);

  // 2. Deploy EnergyToken
  console.log("2. Deploying EnergyToken...");
  const EnergyToken = await hre.ethers.getContractFactory("EnergyToken");
  const energyToken = await EnergyToken.deploy();
  await energyToken.waitForDeployment();
  const energyTokenAddress = await energyToken.getAddress();
  console.log(`   EnergyToken deployed to: ${energyTokenAddress}\n`);

  // 3. Deploy EscrowSettlement
  console.log("3. Deploying EscrowSettlement...");
  const EscrowSettlement = await hre.ethers.getContractFactory(
    "EscrowSettlement"
  );
  const escrow = await EscrowSettlement.deploy();
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`   EscrowSettlement deployed to: ${escrowAddress}\n`);

  // 4. Deploy RenewableEnergyCertificate (before marketplace)
  console.log("4. Deploying RenewableEnergyCertificate...");
  const RenewableEnergyCertificate = await hre.ethers.getContractFactory(
    "RenewableEnergyCertificate"
  );
  const rec = await RenewableEnergyCertificate.deploy();
  await rec.waitForDeployment();
  const recAddress = await rec.getAddress();
  console.log(
    `   RenewableEnergyCertificate deployed to: ${recAddress}\n`
  );

  // 5. Deploy EnergyMarketplace (with certificate contract)
  console.log("5. Deploying EnergyMarketplace...");
  const EnergyMarketplace = await hre.ethers.getContractFactory(
    "EnergyMarketplace"
  );
  const marketplace = await EnergyMarketplace.deploy(
    userRegistryAddress,
    energyTokenAddress,
    recAddress
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log(`   EnergyMarketplace deployed to: ${marketplaceAddress}\n`);

  // 6. Grant necessary permissions
  console.log("6. Granting permissions...\n");

  // Grant marketplace role to escrow contract
  const MARKETPLACE_ROLE = hre.ethers.keccak256(
    hre.ethers.toUtf8Bytes("MARKETPLACE_ROLE")
  );
  let tx = await escrow.grantRole(MARKETPLACE_ROLE, marketplaceAddress);
  await tx.wait();
  console.log("   - Granted MARKETPLACE_ROLE to EnergyMarketplace");

  // Grant ORACLE_ROLE to marketplace
  const ORACLE_ROLE = hre.ethers.keccak256(
    hre.ethers.toUtf8Bytes("ORACLE_ROLE")
  );
  tx = await marketplace.grantRole(ORACLE_ROLE, deployer.address);
  await tx.wait();
  console.log("   - Granted ORACLE_ROLE to deployer (acting as oracle)");

  // Grant CERTIFICATE_ISSUER_ROLE
  const CERTIFICATE_ISSUER_ROLE = hre.ethers.keccak256(
    hre.ethers.toUtf8Bytes("CERTIFICATE_ISSUER_ROLE")
  );
  tx = await rec.grantRole(CERTIFICATE_ISSUER_ROLE, deployer.address);
  await tx.wait();
  console.log("   - Granted CERTIFICATE_ISSUER_ROLE to deployer");

  // Grant CERTIFICATE_ISSUER_ROLE to marketplace (so it can issue certificates)
  tx = await rec.grantRole(CERTIFICATE_ISSUER_ROLE, marketplaceAddress);
  await tx.wait();
  console.log("   - Granted CERTIFICATE_ISSUER_ROLE to EnergyMarketplace");

  // Grant MINTER_ROLE to marketplace deployer
  const MINTER_ROLE = hre.ethers.keccak256(
    hre.ethers.toUtf8Bytes("MINTER_ROLE")
  );
  tx = await energyToken.grantRole(MINTER_ROLE, marketplaceAddress);
  await tx.wait();
  console.log("   - Granted MINTER_ROLE to EnergyMarketplace");

  // Grant TRANSFER_ROLE to marketplace (so it can transfer tokens on behalf of producers)
  const TRANSFER_ROLE = hre.ethers.keccak256(
    hre.ethers.toUtf8Bytes("TRANSFER_ROLE")
  );
  tx = await energyToken.grantRole(TRANSFER_ROLE, marketplaceAddress);
  await tx.wait();
  console.log("   - Granted TRANSFER_ROLE to EnergyMarketplace");

  console.log("\n✅ All contracts deployed successfully!\n");

  // Display summary
  console.log("=== DEPLOYMENT SUMMARY ===\n");
  console.log("Contract Addresses:");
  console.log(`  UserRegistry:              ${userRegistryAddress}`);
  console.log(`  EnergyToken:               ${energyTokenAddress}`);
  console.log(`  EscrowSettlement:          ${escrowAddress}`);
  console.log(`  EnergyMarketplace:         ${marketplaceAddress}`);
  console.log(`  RenewableEnergyCertificate: ${recAddress}\n`);

  // Display .env format for easy copy-paste
  console.log("=== COPY-PASTE TO .env ===\n");
  console.log("VITE_MARKETPLACE_ADDRESS=" + marketplaceAddress);
  console.log("VITE_USER_REGISTRY_ADDRESS=" + userRegistryAddress);
  console.log("VITE_ENERGY_TOKEN_ADDRESS=" + energyTokenAddress);
  console.log("VITE_ESCROW_ADDRESS=" + escrowAddress);
  console.log("VITE_CERTIFICATE_ADDRESS=" + recAddress);
  console.log("VITE_NETWORK=sepolia\n");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      UserRegistry: userRegistryAddress,
      EnergyToken: energyTokenAddress,
      EscrowSettlement: escrowAddress,
      EnergyMarketplace: marketplaceAddress,
      RenewableEnergyCertificate: recAddress,
    },
  };

  console.log("Deployment configuration saved. Ready for testing!\n");

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
