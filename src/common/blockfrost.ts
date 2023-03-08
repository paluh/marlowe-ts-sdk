import { pipe } from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as API from '@blockfrost/blockfrost-js'
import { Blockfrost, Lucid, C, Network, PrivateKey, PolicyId, getAddressDetails, toUnit, fromText, NativeScript, Tx , Msg ,Core, TxSigned, TxComplete, Script } from 'lucid-cardano';
import * as O from 'fp-ts/Option'
import { matchI } from 'ts-adt';
import getUnixTime from 'date-fns/getUnixTime';
import { addDays, addHours,addMinutes, addSeconds } from 'date-fns/fp'
import { log } from './logging'
import * as TE from 'fp-ts/TaskEither'

export class Asset {
    policyId:string;
    tokenName:string;

    public constructor(policyId:string,tokenName:string){
        this.policyId  = policyId;
        this.tokenName = tokenName;
    }
}
export type Address = string;

export class Configuration {
    projectId:string;
    network:Network;
    blockfrostUrl:string

    public constructor (projectId:string, blockfrostUrl:string,network:Network, ) {
        this.projectId = projectId;
        this.network = network;
        this.blockfrostUrl = blockfrostUrl;
    }
}

export const getPrivateKeyFromHexString = (privateKeyHex:string) : PrivateKey => C.PrivateKey.from_bytes(Buffer.from(privateKeyHex, 'hex')).to_bech32()

export class SingleAddressAccount {
    private privateKeyBech32: string;
    private configuration:Configuration;
    private lucid : Lucid;
    private blockfrostApi: API.BlockFrostAPI;
    
    public address : Address;
    
    private constructor (configuration:Configuration,privateKeyBech32:PrivateKey) {
        this.privateKeyBech32 = privateKeyBech32;
        this.configuration = configuration;
        this.blockfrostApi = new API.BlockFrostAPI({projectId: configuration.projectId}); 
    }

    public static async Initialise ( configuration:Configuration, privateKeyBech32: string) {
        const account = new SingleAddressAccount(configuration,privateKeyBech32);
        await account.initialise();
        return account;
    }

    public static async Random ( configuration:Configuration) {
        const privateKey = C.PrivateKey.generate_ed25519().to_bech32();
        const account = new SingleAddressAccount(configuration,privateKey);
        await account.initialise();
        return account;
    }

    private async initialise () {
        this.lucid = await Lucid.new(new Blockfrost(this.configuration.blockfrostUrl, this.configuration.projectId),this.configuration.network);
        this.lucid.selectWalletFromPrivateKey(this.privateKeyBech32);
        this.address = await this.lucid.wallet.address ();
     }
    
    public async adaBalance () { 
        const content = await this.blockfrostApi.addresses(this.address);
        return pipe( content.amount??[]
            , A.filter((amount) => amount.unit === "lovelace")
            , A.map((amount) => BigInt(amount.quantity))
            , A.head
            , O.getOrElse(() => 0n));
                     
    }
    
    public tokenBalance : (asset:Asset) => TE.TaskEither<Error,bigint> 
        = (asset) => 
            pipe(TE.tryCatch(
                        () => this.blockfrostApi.addresses(this.address),
                        (reason) => new Error(`Error while signing : ${reason}`))
                , TE.map( (content) => pipe(content.amount??[]
                                            , A.filter((amount) => amount.unit === toUnit(asset.policyId, fromText(asset.tokenName)))
                                            , A.map((amount) => BigInt(amount.quantity))
                                            , A.head
                                            , O.getOrElse(() => 0n))))
                     
    
    public provision : (provisionning: Map<SingleAddressAccount,BigInt>) => TE.TaskEither<Error,Boolean> = (provisionning) => 
        pipe ( Array.from(provisionning.entries())
                    , A.reduce ( this.lucid.newTx()
                              , (tx:Tx, account: [SingleAddressAccount,BigInt]) => tx.payToAddress(account[0].address, { lovelace:account[1].valueOf()}))
                    , build                   
                    , TE.chain(this.signSubmitAndWaitConfirmation))

    public randomPolicyId() : [Script,PolicyId] {
        const { paymentCredential } = getAddressDetails(this.address);
        const before = this.lucid.currentSlot() + (5 * 60) 
        const json : NativeScript = {
                        type: "all",
                        scripts: [
                            {
                                type: "before",
                                slot: before.valueOf(),
                            },
                            { type: "sig", keyHash: paymentCredential?.hash! }
                        ],
                    };
        const script = this.lucid.utils.nativeScriptFromJson(json);
        const policyId = this.lucid.utils.mintingPolicyToId(script); 
        return [script,policyId];
    }

    public mintTokens(policyRefs : [Script,PolicyId] , tokenName:string, amount: BigInt) : TE.TaskEither<Error,boolean> {
        const { paymentCredential } = getAddressDetails(this.address);
        const before = this.lucid.currentSlot() + (5 * 60) 
        const validTo = this.lucid.currentSlot() + 60
        const [mintingPolicy,policyId] = policyRefs             
        return pipe( this.lucid.newTx()
                                .mintAssets({[toUnit(policyId, fromText(tokenName))]: amount.valueOf()})
                                .validTo(Date.now() + 100000)
                                .attachMintingPolicy(mintingPolicy)
                   , build
                   , TE.chain(this.signSubmitAndWaitConfirmation)
                   )
    }

    public fromTxBodyCBOR (cbor : string) : TxComplete {
        return new TxComplete (this.lucid,Core.Transaction.new( Core.TransactionBody.from_bytes (Buffer.from(cbor, 'hex'))
                                                              , Core.TransactionWitnessSet.new()
                                                            , undefined))
    } 

    public sign : (txBuilt : TxComplete ) => TE.TaskEither<Error,TxSigned> 
        =  (txBuilt) => 
                TE.tryCatch(
                    () => txBuilt.sign().complete(),
                    (reason) => new Error(`Error while signing : ${reason}`));
    
    public signTxBody : (txBody : TxComplete) => TE.TaskEither<Error,TxSigned> 
        =  (txBuilt) => 
                TE.tryCatch(
                    () => txBuilt.signWithPrivateKey(this.privateKeyBech32).complete(),
                    (reason) => new Error(`Error while signing : ${reason}`));


    public submit : (signedTx : TxSigned ) => TE.TaskEither<Error,string> 
        = (signedTx) => 
            TE.tryCatch(
                () => signedTx.submit(),
                (reason) => new Error(`Error while submitting : ${reason}`));
    
    public waitConfirmation : (txHash : string ) => TE.TaskEither<Error,boolean> 
        = (txHash) => 
            TE.tryCatch(
                () => this.lucid.awaitTx(txHash),
                (reason) => new Error(`Error while submitting : ${reason}`));

    public signSubmitAndWaitConfirmation : (txBuilt : TxComplete) => TE.TaskEither<Error,boolean> 
        = (txBuilt) =>         
            pipe(this.sign(txBuilt)
                ,TE.chainFirst((x) => TE.of(log(`Transaction signed. ${x}`)))
                ,TE.chain(this.submit)
                ,TE.chainFirst((txHash) => TE.of(log(`Transaction ${txHash} submitted.`)))
                ,TE.chain(this.waitConfirmation))
    
        
}

const build : (tx : Tx ) => TE.TaskEither<Error,TxComplete> 
    = (tx) => TE.tryCatch(
                        () => tx.complete(),
                        (reason) => new Error(`Error while building Tx : ${reason}`));
