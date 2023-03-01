import { pipe } from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as API from '@blockfrost/blockfrost-js'
import { Blockfrost, Lucid, C, Network, PrivateKey } from 'lucid-cardano';

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
    
    private constructor (privateKeyBech32:PrivateKey) {
        this.privateKeyBech32 = privateKeyBech32;
    }

    public static async Initialise ( configuration:Configuration, privateKeyBech32: string) {
        const account = new SingleAddressAccount(privateKeyBech32);
        account.configuration = configuration;
        account.blockfrostApi = new API.BlockFrostAPI({projectId: configuration.projectId}); 
        await account.initialise();
        return account;
    }

    public static async Random ( configuration:Configuration) {
        const privateKey = C.PrivateKey.generate_ed25519().to_bech32();
        const account = new SingleAddressAccount(privateKey);
        account.configuration = configuration; 
        await account.initialise();
        return account;
    }

    private async initialise () {
        this.lucid = await Lucid.new(new Blockfrost(this.configuration.blockfrostUrl, this.configuration.projectId),this.configuration.network);
        this.lucid.selectWalletFromPrivateKey(this.privateKeyBech32);
        this.address = await this.lucid.wallet.address ();
     }
    
    ADABalance = async (): Promise<Number> => 
        this.blockfrostApi.addresses(this.address).then((content) =>  
            Number(pipe( content.amount
                       , A.filter((amount) => amount.unit === "lovelace"),A.map((amount) => amount.quantity))[0]))
               

    public provision(account: SingleAddressAccount, ada: Number) : Promise<Number> {
        console.log ('Provisioning:',account.address); 
        return Promise.resolve(ada)}
}


// const privateKey = lucid.utils.generatePrivateKey();
//       console.log('Private', privateKey);