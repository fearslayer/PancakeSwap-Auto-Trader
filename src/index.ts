import { BigNumber } from "@ethersproject/bignumber";
import { JsonRpcProvider } from "@ethersproject/providers";
import { formatEther, parseEther } from "@ethersproject/units";
import { Wallet } from "@ethersproject/wallet";
import { blue, green, red, white, yellow } from "chalk";
import { clear } from "console";
import dotenv from "dotenv";
import readline from "readline";
import { PancakePredictionV2__factory } from "./types/typechain";

dotenv.config();

// Global Config
const GLOBAL_CONFIG = {
  PPV2_ADDRESS: "0x18B2A687610328590Bc8F2e5fEdDe3b582A49cdA",
  AMOUNT_TO_BET: process.env.BET_AMOUNT || "0.1", // in BNB,
  BSC_RPC: "https://bsc-dataseed.binance.org/", // You can provide any custom RPC
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  LAST_BET: "NESSUNA PUNTATA",
  MARTINGALE_LOSE: 0,
  AMOUNT_TO_BET_MARTINGALE: process.env.BET_AMOUNT || "0.1",
  MARTINGALE_NUM: 3,
  SOUND: process.env.SOUND || "true",
};

clear();
console.log(green("PancakePredictionV3 By DANIELE & STEFANO"));

if (!GLOBAL_CONFIG.PRIVATE_KEY) {
  console.log(
    blue(
      "The private key was not found in .env. Enter the private key here, or enter it in .env, so as not to enter it again."
    )
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter your private key: ", (privateKey) => {
    if (!privateKey) {
      console.log(red("Error, restart a program and try again."));

      process.exit(1);
    }

    GLOBAL_CONFIG.PRIVATE_KEY = privateKey;

    rl.close();
  });
}

const signer = new Wallet(
  GLOBAL_CONFIG.PRIVATE_KEY as string,
  new JsonRpcProvider(GLOBAL_CONFIG.BSC_RPC)
);

const predictionContract = PancakePredictionV2__factory.connect(
  GLOBAL_CONFIG.PPV2_ADDRESS,
  signer
);

// Utility Function to use **await sleep(ms)**
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
var PUNTATA = false;
var bearBet = false;

console.log(
  blue("Starting. Amount to Bet:", GLOBAL_CONFIG.AMOUNT_TO_BET, "BNB"),
  "\nWaiting for new rounds. It can take up to 5 min, please wait..."
);

predictionContract.on("StartRound", async (epoch: BigNumber) => {
  console.log(yellow("\n ------------------------------------- "));
  console.log(yellow("Next Round Epoch", epoch.toString()));

  // Waiting for 278sec = 4.63min
  const WAITING_TIME = 275000;

  console.log(yellow("Waiting to enter the trade , dont close the script.. !! "));

  await sleep(WAITING_TIME);
  console.log("\nGetting Amounts");

  //CALCOLO SE PUNTATE BULL O BEAR
  const { bullAmount, bearAmount } = await predictionContract.rounds(epoch);
  bearBet =
    ((bullAmount.gt(bearAmount) && bullAmount.div(bearAmount).lt(5)) ||
      (bullAmount.lt(bearAmount) && bearAmount.div(bullAmount).gt(5))) &&
    Math.random() < 0.8;

  if (bearBet) {
    console.log(green("Betting on Bear Bet."));
  } else {
    console.log(green("Betting on Bull Bet."));
  }

  //ESEGUI LA PUNTATA
  console.log("\nBetting is Started.");
  if (bearBet) {
    try {
      const tx = await predictionContract.betBear(epoch, {
        value: parseEther(GLOBAL_CONFIG.AMOUNT_TO_BET_MARTINGALE),
      });

      console.log("Bear Betting Tx Started.");

      await tx.wait();

      console.log(blue("Bear Betting Tx Success."));
      PUNTATA = true;
    } catch {
      console.log(red("Bear Betting Tx Error"));
      PUNTATA = false;
    }
  } else {
    try {
      const tx = await predictionContract.betBull(epoch, {
        value: parseEther(GLOBAL_CONFIG.AMOUNT_TO_BET_MARTINGALE),
      });

      console.log("Bull Betting Tx Started.");

      await tx.wait();

      console.log(blue("Bull Betting Tx Success."));
      PUNTATA = true;
    } catch {
      console.log(red("Bull Betting Tx Error"));
      PUNTATA = false;
    }
  }

  console.log(green("\n ------------------------------------- "));
  console.log(green("Epoch", epoch.toString()));
  console.log(green("Bull Amount", formatEther(bullAmount), "BNB"));
  console.log(blue("Bear Amount", formatEther(bearAmount), "BNB"));
  console.log(
    yellow(
      "puntata di ",
      GLOBAL_CONFIG.AMOUNT_TO_BET_MARTINGALE.toString(),
      " BNB"
    )
  );

  const claimableEpochs: BigNumber[] = [];
  //CONTROLLA SE DEVI CLAIMARE QUALCOSA
  for (let i = 1; i <= 10; i++) {
    const epochToCheck = epoch.sub(i);
    //console.log(epochToCheck)

    const [claimable, refundable, { claimed, amount }] = await Promise.all([
      predictionContract.claimable(epochToCheck, signer.address),
      predictionContract.refundable(epochToCheck, signer.address),
      predictionContract.ledger(epochToCheck, signer.address),
    ]);

    if (amount.gt(0) && (claimable || refundable) && !claimed) {
      claimableEpochs.push(epochToCheck);
    }
  }

  //SE DEVI CLAIMARE QUALCOSA , ABILITA IL CLAIM
  if ( claimableEpochs.length >= 1 ) {
    try {
      sleep(3000);
      const tx = await predictionContract.claim(claimableEpochs);
      console.log("\nClaim Tx Started");
      await tx.wait();

      console.log(green("Claim Tx Success"));
    } catch {
      console.log(red("Claim Tx Error"));
    }
  }

});

predictionContract.on("EndRound", async (epoch: BigNumber) => {

  sleep(2000)
  console.log(red("\n ------------------------------------- "));
  console.log(red(" ended Epoch", epoch.toString()));

  if (PUNTATA == true) {
    const ROUNDLOCK = (await predictionContract.rounds(epoch)).lockPrice;
    console.log(
      red("\nIl lockedprice del round precedente è ", ROUNDLOCK.toString())
    );

    const ROUNDCHIUSO = (await predictionContract.rounds(epoch)).closePrice;
    console.log(
      red("Il closedprice del round precedente è ", ROUNDCHIUSO.toString())
    );

    var RoundPrecedente = "";

    if (ROUNDCHIUSO > ROUNDLOCK) {
      RoundPrecedente = "BULL";
      console.log(
        blue(
          "\nil round era un BULL tu hai puntato ",
          GLOBAL_CONFIG.LAST_BET.toString()
        )
      );
    } else {
      RoundPrecedente = "BEAR";
      console.log(
        blue(
          "\nil round era un BEAR tu hai puntato ",
          GLOBAL_CONFIG.LAST_BET.toString()
        )
      );
    }

    if (RoundPrecedente == GLOBAL_CONFIG.LAST_BET) {
      GLOBAL_CONFIG.AMOUNT_TO_BET_MARTINGALE = GLOBAL_CONFIG.AMOUNT_TO_BET
      console.log(green("Hai vinto , prossima bet : ",GLOBAL_CONFIG.AMOUNT_TO_BET_MARTINGALE," BNB"));
      GLOBAL_CONFIG.MARTINGALE_LOSE = 0;
    } else {
      GLOBAL_CONFIG.MARTINGALE_LOSE = GLOBAL_CONFIG.MARTINGALE_LOSE + 1;
    }

    if (GLOBAL_CONFIG.MARTINGALE_LOSE == GLOBAL_CONFIG.MARTINGALE_NUM) {
      console.log(red("\n ------------------------------------- "));
      console.log(red(" Epoch", epoch.toString()));
      console.log(
        "HAI PERSO PER UN LIMITE DI ",
        GLOBAL_CONFIG.MARTINGALE_NUM,
        " IL TUO BET VERRà RESETTATO"
      );
      GLOBAL_CONFIG.MARTINGALE_LOSE = 0;
    }

    if (GLOBAL_CONFIG.LAST_BET == "NESSUNA PUNTATA") {
      GLOBAL_CONFIG.MARTINGALE_LOSE = 0;
    }

    if (GLOBAL_CONFIG.MARTINGALE_LOSE == 0) {
      GLOBAL_CONFIG.AMOUNT_TO_BET_MARTINGALE = GLOBAL_CONFIG.AMOUNT_TO_BET
    } else {
      console.log(red("\n ------------------------------------- "));
      console.log(red("Epoch", epoch.toString()));
      console.log(
        red(
          "\nHAI PERSO LO SCORSO BET , LA PROSSIMA PUNTATA SARà di = ",
          parseFloat(GLOBAL_CONFIG.AMOUNT_TO_BET_MARTINGALE) * 2,
          " BNB"
        )
      );

      var PUNTATAINT = parseFloat(GLOBAL_CONFIG.AMOUNT_TO_BET_MARTINGALE);
      if (GLOBAL_CONFIG.MARTINGALE_LOSE == 0) {
        GLOBAL_CONFIG.AMOUNT_TO_BET_MARTINGALE = GLOBAL_CONFIG.AMOUNT_TO_BET;
      } else {
          PUNTATAINT = PUNTATAINT * 2;
      }

      GLOBAL_CONFIG.AMOUNT_TO_BET_MARTINGALE = PUNTATAINT.toString();
    }

    if (bearBet) {
      GLOBAL_CONFIG.LAST_BET = "BEAR";
    } else {
      GLOBAL_CONFIG.LAST_BET = "BULL";
    }

    PUNTATA = false;
  } else {
    console.log(
      yellow(
        "NON HAI NESSUNA PUNTATA PER QUESTO ROUND , ATTENDERE IL PROSSIMO.. "
      )
    );
  }

});
