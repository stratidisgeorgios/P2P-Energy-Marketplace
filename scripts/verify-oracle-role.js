const hre = require("hardhat");
const { ethers } = require("ethers");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\nChecking oracle role for: ${deployer.address}\n`);

  // Get marketplace address from env
  const marketplaceAddress = process.env.VITE_MARKETPLACE_ADDRESS || "0x3AC8fDe9E9dfb870E977bF976fF04Cda26AeD139";
  console.log(`Marketplace: ${marketplaceAddress}`);

  // Get marketplace contract
  const Marketplace = await hre.ethers.getContractFactory("EnergyMarketplace");
  const marketplace = Marketplace.attach(marketplaceAddress);

  // Define roles
  const ORACLE_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ORACLE_ROLE"));
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

  console.log(`\nORACLE_ROLE: ${ORACLE_ROLE}`);
  console.log(`DEFAULT_ADMIN_ROLE: ${DEFAULT_ADMIN_ROLE}`);

  // Check if deployer has ORACLE_ROLE
  const hasOracleRole = await marketplace.hasRole(ORACLE_ROLE, deployer.address);
  console.log(`\nDeployer has ORACLE_ROLE: ${hasOracleRole}`);

  // Check if deployer has DEFAULT_ADMIN_ROLE
  const hasAdminRole = await marketplace.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  console.log(`Deployer has DEFAULT_ADMIN_ROLE: ${hasAdminRole}`);

  if (!hasOracleRole) {
    console.log(`\n❌ Deployer does NOT have ORACLE_ROLE. Granting now...`);
    const tx = await marketplace.grantRole(ORACLE_ROLE, deployer.address);
    await tx.wait();
    console.log(`✅ ORACLE_ROLE granted!`);
  } else {
    console.log(`\n✅ Deployer already has ORACLE_ROLE`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
