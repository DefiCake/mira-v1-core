use std::str::FromStr;

use fuel_tx::input::contract::Contract as FuelTxContract;
use fuel_tx::{Contract, Input};
use fuels::{
    accounts::{
        provider::Provider,
        wallet::{Wallet, WalletUnlocked},
    },
    client::{PageDirection, PaginationRequest},
    macros::abigen,
    types::{
        bech32::{Bech32ContractId, FUEL_BECH32_HRP},
        transaction::Transaction,
        ContractId,
    },
};

const RPC_URL: &str = "<GRAPHQL>";
const POOL_ID: &str = "2e40f2b244b98ed6b8204b3de0156c6961f98525c8162f80162fcf53eebd90e7";

abigen!(
    Contract(
        name = "MiraAMM",
        abi = "./contracts/mira_amm_contract/out/release/mira_amm_contract-abi.json"
    ),
    Contract(
        name = "MockToken",
        abi = "./contracts/mocks/mock_token/out/release/mock_token-abi.json"
    )
);

// Incomplete 
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let provider = Provider::connect(RPC_URL).await?;
    let chain_id = provider.chain_id();
    let wallet = WalletUnlocked::new_random(Some(provider.clone()));
    let pool_id_bytes: [u8; 32] = hex::decode(POOL_ID)?.as_slice().try_into()?;
    let bech32_id = Bech32ContractId::new(FUEL_BECH32_HRP, pool_id_bytes);
    let contract_id: ContractId = bech32_id.clone().into();
    let pool = MiraAMM::new(bech32_id, wallet);

    let mut cursor: Option<String> = None;

    loop {
        let response = provider
            .get_transactions(PaginationRequest {
                cursor,
                results: 100,
                direction: PageDirection::Forward,
            })
            .await?;

        let txs = response.results;

        for tx in txs {
            match tx.transaction {
                fuels::types::transaction::TransactionType::Script(script_transaction) => {
                    let id = script_transaction.id(chain_id);
                    let inputs = script_transaction.inputs().clone();
                    let contracts: Vec<FuelTxContract> = inputs
                        .iter()
                        .filter(|input| {
                            matches!(input, Input::Contract(FuelTxContract { contract_id, .. }))
                        })
                        .map(|input| {
                            if let Input::Contract(contract) = input {
                                contract.clone()
                            } else {
                                todo!();
                            }
                        })
                        filter(|contract| contract)
                        .collect();
                    // dbg!(contracts);
                }
                _ => {}
            };
        }

        if !response.has_next_page {
            break;
        }
        dbg!(&response.cursor);
        cursor = response.cursor;
    }

    Ok(())
}
