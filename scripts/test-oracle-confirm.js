const hre = require("hardhat");

async function main() {
  const [deployer, producer, consumer] = await hre.ethers.getSigners();

  console.log(`\nTesting oracle confirmDelivery...\n`);
  console.log(`Deployer (Oracle): ${deployer.address}`);
  console.log(`Producer: ${producer.address}`);
  console.log(`Consumer: ${consumer.address}\n`);

  // Get deployed contracts
  const marketplaceAddress = "0x3AC8fDe9E9dfb870E977bF976fF04Cda26AeD139";
  const tokenAddress = "0xA9eDDFF519660F330136Ea8B9fee2A910f13ffb9";

  const Marketplace = await hre.ethers.getContractFactory("EnergyMarketplace");
  const marketplace = Marketplace.attach(marketplaceAddress);

  const Token = await hre.ethers.getContractFactory("EnergyToken");
  const token = Token.attach(tokenAddress);

  // Check if oracle has ORACLE_ROLE
  const ORACLE_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ORACLE_ROLE"));
  const hasRole = await marketplace.hasRole(ORACLE_ROLE, deployer.address);
  console.log(`✅ Oracle has ORACLE_ROLE: ${hasRole}\n`);

  // Get trade 1
  const trade = await marketplace.trades(1);
  console.log(`Trade 1 state:`);
  console.log(`  Producer: ${trade.producer}`);
  console.log(`  Consumer: ${trade.consumer}`);
  console.log(`  Energy Amount: ${trade.energyAmount.toString()}`);
  console.log(`  Delivery Confirmed: ${trade.deliveryConfirmed}`);
  console.log(`  Settled: ${trade.settled}\n`);

  // Check producer balance
  const balance = await token.balanceOf(trade.producer);
  console.log(`Producer token balance: ${balance.toString()} (${hre.ethers.formatUnits(balance, 18)} tokens)\n`);

  // Check if marketplace is approved to transfer
  const allowance = await token.allowance(trade.producer, marketplaceAddress);
  console.log(`Marketplace allowance from producer: ${allowance.toString()}\n`);

  if (allowance < trade.energyAmount) {
    console.log(`⚠️  Marketplace needs approval to transfer tokens`);
    console.log(`Need to approve ${trade.energyAmount.toString()} tokens`);
    console.log(`But this requires producer to be connected...\n`);
  }

  // Try to confirm delivery as oracle (deployer)
  try {
    console.log(`Attempting confirmDelivery as oracle...`);
    const tx = await marketplace.confirmDelivery(1);
    console.log(`✅ Success! Tx hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Confirmed! Block: ${receipt.blockNumber}`);
  } catch (error: any) {
    console.error(`❌ Failed:`, error.message);
    if (error.data) {
      console.error(`Error data:`, error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
