import { BigNumber, utils, providers, Signer } from "ethers";
import safe111AndFactoryConfig from "./safe111AndFactoryConfig.json"
import safe120Config from "./safe120Config.json"
import debug from 'debug'

const log = debug("CANONICAL_DEPLOY")

export async function isCanonicalDeployed(provider: providers.Provider) {
  try {
    await checkCode(provider, safe120Config.safeAddress, safe120Config.runtimeCode)
  } catch (e) {
    if (e.message.includes('NotCorrect')) {
      return false
    }
    throw e
  }

  return true
}

export async function deployCanonicals(signer: Signer) {
  const funder = signer
  const provider = signer.provider
  if (!provider) {
    throw new Error("provider is undefined")
  }

  const deploy111AndFactory = async () => {
    const nonce = await provider.getTransactionCount(safe111AndFactoryConfig.deployer)
    if (nonce != 0) {
      console.warn("Deployment account has been used on this network")
      return
    }
    const deploymentCosts111AndFactory = BigNumber.from(safe111AndFactoryConfig.deploymentCosts)
    const deploymentAccountBalance = await provider.getBalance(safe111AndFactoryConfig.deployer)
    if (deploymentAccountBalance.lt(deploymentCosts111AndFactory)) {
      const tx = await funder.sendTransaction({
        to: safe111AndFactoryConfig.deployer,
        value: deploymentCosts111AndFactory.sub(deploymentAccountBalance)
      })
      await tx.wait()
    }
    log("------ Deploy Safe 1.1.1 ------")
    await waitForTx(provider, safe111AndFactoryConfig.deploymentTx)
    await checkCode(provider, safe111AndFactoryConfig.safeAddress, safe111AndFactoryConfig.runtimeCode)
    log("------ Execute Config Tx ------")
    await waitForTx(provider, safe111AndFactoryConfig.configTx)
    log("------ Deploy Factory ------")
    await waitForTx(provider, safe111AndFactoryConfig.factoryDeploymentTx)
    await checkCode(provider, safe111AndFactoryConfig.factoryAddress, safe111AndFactoryConfig.factoryRuntimeCode)
  }
  
  const deploy120 = async () => {
    const deploymentCosts120 = BigNumber.from(safe120Config.deploymentCosts)
    const deploymentAccountBalance = await provider.getBalance(safe120Config.deployer)
    log('price: ', utils.formatEther(deploymentCosts120.sub(deploymentAccountBalance)))
    if (deploymentAccountBalance.lt(deploymentCosts120)) {
      const tx = await funder.sendTransaction({
        to: safe120Config.deployer,
        value: deploymentCosts120.sub(deploymentAccountBalance)
      })
      await tx.wait()
    }
    log("------ Deploy Safe 1.2.0 ------")
    await waitForTx(provider, safe120Config.deploymentTx)
    await checkCode(provider, safe120Config.safeAddress, safe120Config.runtimeCode)
  }
  
  return deploy111AndFactory()
    .then(deploy120)
  
}

const waitForTx = async (provider:providers.Provider, singedTx:string): Promise<providers.TransactionReceipt> => {
  const tx = await provider.sendTransaction(singedTx);
  return await tx.wait()
}

const checkCode = async (provider:providers.Provider, address:string, expectedCode:string): Promise<void> => {
  const code = await provider.getCode(address)
  if (code !== expectedCode) {
    throw new Error(`NotExpectedError: ${expectedCode} != ${code}`)
  }
  log(`Deployment ${code === expectedCode ? "was successful" : "has failed"}`)
}
