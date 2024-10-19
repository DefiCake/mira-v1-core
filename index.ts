import { readJsonSync, writeJsonSync } from "fs-extra";
import "dotenv/config";
import { Provider } from "fuels";
import { MiraAmmContract } from "./typegen";
const fetchSwaps = async (limit: number, offset: number) => {
  const data = {
    sqlQuery: {
      sql:
        "SELECT timestamp, block_number, poolId, token0In,token1Out,token1In,token0Out,transaction_index, transaction_hash from `Swap` ORDER BY `block_number` ASC LIMIT " +
        limit +
        " OFFSET " +
        offset,
    },
  };

  return await fetch(url, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      return data.result.rows.map((row: any) => {
        const swap: Swap = {
          __typeName: "swap",
          poolId: row.poolId,
          timestamp: dateToBigIntString(row.timestamp),
          token0In: row.token0In,
          token0Out: row.token0Out,
          token1In: row.token1In,
          token1Out: row.token1Out,
          transactionIndex: Number(row.transaction_index),
          transactionHash: row.transaction_hash,
          blockNumber: Number(row.block_number),
        };
        return swap;
      });
    })
    .catch((error) => {
      // Handle the error
      console.error("Error:", error);
    });
};

const fetchMints = async (limit: number, offset: number) => {
  const data = {
    sqlQuery: {
      sql:
        "SELECT timestamp, poolId, token0In, token1In, transaction_index, transaction_hash, block_number FROM `Mint` ORDER BY block_number ASC LIMIT " +
        limit +
        " OFFSET " +
        offset,
    },
  };

  return await fetch(url, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      return data.result.rows.map((row: any) => {
        const mint: Mint = {
          __typeName: "mint",
          poolId: row.poolId,
          timestamp: dateToBigIntString(row.timestamp),
          token0In: row.token0In,
          token1In: row.token1In,
          transactionIndex: Number(row.transaction_index),
          transactionHash: row.transaction_hash,
          blockNumber: Number(row.block_number),
        };
        return mint;
      });
    })
    .catch((error) => {
      // Handle the error
      console.error("Error:", error);
    });
};

const fetchBurns = async (limit: number, offset: number) => {
  const data = {
    sqlQuery: {
      sql:
        "SELECT timestamp, poolId, token0Out, token1Out, transaction_index, transaction_hash, block_number FROM `Burn` ORDER BY block_number ASC LIMIT " +
        limit +
        " OFFSET " +
        offset,
    },
  };

  return await fetch(url, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      return data.result.rows.map((row: any) => {
        const burn: Burn = {
          __typeName: "burn",
          poolId: row.poolId,
          timestamp: dateToBigIntString(row.timestamp),
          token0Out: row.token0Out,
          token1Out: row.token1Out,
          transactionIndex: Number(row.transaction_index),
          transactionHash: row.transaction_hash,
          blockNumber: Number(row.block_number),
        };
        return burn;
      });
    })
    .catch((error) => {
      // Handle the error
      console.error("Error:", error);
    });
};

const url =
  "https://app.sentio.xyz/api/v1/analytics/fuellabs/mira-mainnet-2/sql/execute";
const apiKey = process.env.API_KEY!;

type Swap = {
  __typeName: "swap";
  poolId: string;
  timestamp: string;
  token0In: string;
  token0Out: string;
  token1In: string;
  token1Out: string;
  transactionIndex: number;
  transactionHash: string;
  blockNumber: number;
};

type Mint = {
  __typeName: "mint";
  poolId: string;
  timestamp: string;
  token0In: string;
  token1In: string;
  transactionIndex: number;
  transactionHash: string;
  blockNumber: number;
};

type Burn = {
  __typeName: "burn";
  poolId: string;
  timestamp: string;
  token0Out: string;
  token1Out: string;
  transactionIndex: number;
  transactionHash: string;
  blockNumber: number;
};

type MiraEvent = Swap | Mint | Burn;

const main = async () => {
  const events: MiraEvent[] = [];
  let offset = 0;

  // Store the swaps on the first run
  let swaps: Swap[] = readJsonSync("./swaps.json");
  if (swaps.length === 0) {
    do {
      swaps = await fetchSwaps(1000, offset);
      if (swaps.length > 0) {
        events.push(...swaps);
      }
      offset += 1000;
    } while (swaps.length > 0);

    writeJsonSync("./swaps.json", events, { spaces: 2 });
  } else {
    events.push(...swaps);
  }

  let mints: Mint[] = readJsonSync("./mints.json");
  offset = 0;
  if (mints.length === 0) {
    do {
      mints = await fetchMints(1000, offset);
      if (mints.length > 0) {
        events.push(...mints);
      }
      offset += 1000;
    } while (mints.length > 0);

    const allMints = events.filter((e) => e.__typeName === "mint");
    writeJsonSync("./mints.json", allMints, { spaces: 2 });
  } else {
    events.push(...mints);
  }

  let burns: Burn[] = [];
  offset = 0;
  do {
    burns = await fetchBurns(1000, offset);

    if (burns.length > 0) {
      events.push(...burns);
    }
    offset += 1000;
  } while (burns.length > 0);

  const poolInfo: {
    [poolId: string]: {
      k?: bigint;
      reserves0?: bigint;
      reserves1?: bigint;
      events: MiraEvent[];
    };
  } = {};

  // Split the events by pool
  for (const event of events) {
    if (poolInfo[`${event.poolId}`] === undefined) {
      poolInfo[event.poolId] = { events: [] };
    }

    poolInfo[event.poolId].events.push(event);
  }

  // Order the events, most recent first
  for (const poolId of Object.keys(poolInfo)) {
    const allEvents = poolInfo[poolId].events;
    const sortedEvents = allEvents.sort((a, b) => {
      return a.blockNumber - b.blockNumber;
    });

    poolInfo[poolId].events = sortedEvents;
  }

  // Now calculate reserves at each event
  const healthyPools: string[] = [];
  for (const poolId of Object.keys(poolInfo)) {
    const isStablePool = poolId.includes("true");

    if (poolInfo[poolId].events[0].__typeName !== "mint") {
      console.log("Pool ID", poolId, "does not start with a mint");
      continue;
    }

    const t0_in = BigInt(
      (poolInfo[poolId].events[0] as unknown as Mint).token0In
    );
    const t1_in = BigInt(
      (poolInfo[poolId].events[0] as unknown as Mint).token1In
    );
    let k = t0_in * t1_in;
    let reserves0 = t0_in;
    let reserves1 = t1_in;

    let poolIsHealthy = true;
    for (const [index, event] of poolInfo[poolId].events.entries()) {
      if (index === 0) {
        continue;
      }

      if (event.__typeName === "mint") {
        reserves0 += BigInt(event.token0In);
        reserves1 += BigInt(event.token1In);
        k = reserves0 * reserves1;
      }

      if (event.__typeName === "burn") {
        reserves0 -= BigInt(event.token0Out);
        reserves1 -= BigInt(event.token1Out);
        k = reserves0 * reserves1;
      }

      if (event.__typeName === "swap") {
        const token0In = BigInt(event.token0In);
        const token1In = BigInt(event.token1In);
        const token0Out = BigInt(event.token0Out);
        const token1Out = BigInt(event.token1Out);

        const broken = invariantBroken(
          reserves0,
          reserves1,
          token0In,
          token1In,
          token0Out,
          token1Out,
          isStablePool
        );

        if (broken) {
          console.log("Invariant broken at pool", poolId);
          poolIsHealthy = false;
          break;
        }
        reserves0 += BigInt(event.token0In);
        reserves1 += BigInt(event.token1In);
        reserves0 -= BigInt(event.token0Out);
        reserves1 -= BigInt(event.token1Out);
        k = reserves0 * reserves1;
      }
    }

    if (poolIsHealthy) {
      healthyPools.push(poolId);
      poolInfo[poolId].k = k;
      poolInfo[poolId].reserves0 = reserves0;
      poolInfo[poolId].reserves1 = reserves1;
    }
  }

  const provider = await Provider.create(process.env.RPC_URL!);
  const contract = new MiraAmmContract(
    "0x2e40f2b244b98ed6b8204b3de0156c6961f98525c8162f80162fcf53eebd90e7",
    provider
  );
  for (const healthyPoolId of healthyPools) {
    const [a0, a1] = healthyPoolId.split("-");
    const isStablePool = healthyPoolId.includes("true");
    const asset_id_0 = { bits: "0x" + a0 };
    const asset_id_1 = { bits: "0x" + a1 };

    const metadata = await contract.functions
      .pool_metadata([asset_id_0, asset_id_1, isStablePool])
      .get();

    console.log(healthyPoolId);
    console.log("current reserve0", metadata.value?.reserve_0.toString());
    console.log(
      "computed reserve0",
      poolInfo[healthyPoolId].reserves0?.toString()
    );
    console.log("current reserve1", metadata.value?.reserve_1.toString());
    console.log(
      "computed reserve1",
      poolInfo[healthyPoolId].reserves1?.toString()
    );
    console.log("\n");
  }
};

function invariantBroken(
  reserve0: bigint,
  reserve1: bigint,
  token0In: bigint,
  token1In: bigint,
  token0Out: bigint,
  token1Out: bigint,
  isStablePool: boolean = false // TODO! need to use a different K with stable pools
) {
  const preK = reserve0 * reserve1;
  const postK =
    (reserve0 + token0In - token0Out) * (reserve1 + token1In - token1Out);
  return postK < preK;
}

main()
  .then(() => {})
  .catch(console.error)
  .finally(() => process.exit(0));

function dateToBigIntString(dateString: string): string {
  const date = new Date(dateString);
  const timestamp = date.getTime(); // Get timestamp in milliseconds
  return BigInt(timestamp).toString();
}
