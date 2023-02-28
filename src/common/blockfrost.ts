import { components } from '@blockfrost/openapi';
import { pipe } from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as API from '@blockfrost/blockfrost-js'
import { Blockfrost, Lucid, C, Network } from 'lucid-cardano';


type AddressContent = components ['schemas']['address_content']
export type Address = string;

export class e2eAPI {
    private projectId:string;
    private network:Network;
    private blockfrostUrl:string
    private blockfrostApi: API.BlockFrostAPI;
    private bankLucid : Lucid;
    private bankPrivateKeyBech32: string;
      
    private constructor 
        ( projectId: string
        , blockfrostUrl:string
        , network:Network
        , bankPrivateKeyHex: string) {
        this.blockfrostUrl = blockfrostUrl;
        this.projectId = projectId;
        this.network = network;
        this.bankPrivateKeyBech32 = C.PrivateKey.from_bytes(Buffer.from(bankPrivateKeyHex, 'hex')).to_bech32();
        this.blockfrostApi = new API.BlockFrostAPI({projectId: projectId});
    }

    private async init () {
       this.bankLucid = await Lucid.new(new Blockfrost(this.blockfrostUrl, this.projectId),this.network);
       this.bankLucid.selectWalletFromPrivateKey(this.bankPrivateKeyBech32);
    }
    public static async Init 
        ( projectId: string
        , blockfrostUrl:string
        , network:Network
        , bankPrivateKeyHex: string) {
        const e2eApi = new e2eAPI(projectId,blockfrostUrl,network,bankPrivateKeyHex);
        await e2eApi.init();
        return e2eApi;
    }

    public async bankAddress () {
        const address = await this.bankLucid.wallet.address ();
        return address;
    }

    bankADATreasuryAmount = async (): Promise<[Address,Number]> => 
        this.bankAddress().then(async (address) => {
            const content : AddressContent = await this.blockfrostApi.addresses(address); 
            return [ address
                   , Number(pipe(content.amount,A.filter((amount) => amount.unit === "lovelace"),A.map((amount) => amount.quantity))[0])
                   ];
        });
    
    public createAccountWith(ada:Number) {
        return 
    }     
} 

class Account {
    private bankPrivateKeyBech32: string;
    
    constructor () {}
}


// const privateKey = lucid.utils.generatePrivateKey();
//       console.log('Private', privateKey);