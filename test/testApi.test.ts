
import * as ADA from '../src/common/ada'
import { Configuration, getPrivateKeyFromHexString, SingleAddressAccount} from '../src/common/blockfrost'

describe('@marlowe-runtime-client',  () => {
  describe('Contract Headers', () => {
    it('can all be fetched', async () => {
      const configuration = new Configuration ('preprodrj4joQQ9n2iGp7IjBh39DoxnomNvsNRl'
                                              ,'https://cardano-preprod.blockfrost.io/api/v0'
                                              ,'Preprod');
      const bank = await SingleAddressAccount.Initialise (configuration,getPrivateKeyFromHexString('5820e09f58cd4b2793ff35281c36af06760d4ab993829c7a1d3b29db2947576339b1'))
      const ownerAccount = await SingleAddressAccount.Random(configuration);
      const recipientAccount = await SingleAddressAccount.Random(configuration);
        
      bank.ADABalance().then ((amount) => {
        console.log('Bank public key:', bank.address);
        console.log('Balance:', ADA.format(amount));
        expect(amount).toBeGreaterThan(100_000_000)
      });
      
      await Promise.all([bank.provision(ownerAccount,10_000_000),bank.provision(recipientAccount,10_000_000)]);

      ownerAccount.ADABalance().then ((amount) => {
        console.log('Owner public key:', ownerAccount.address);
        console.log('Balance:', ADA.format(amount));
        expect(amount).toBeGreaterThan(10_000_000)
      });

      recipientAccount.ADABalance().then ((amount) => {
        console.log('Owner public key:', ownerAccount.address);
        console.log('Balance:', ADA.format(amount));
        expect(amount).toBeGreaterThan(10_000_000)
      });      
    }); 
  });
});