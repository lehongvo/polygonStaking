// CHALLENGE-2737: ExerciseSupplementNFTSpecial1/2 are deployed live on Kaia mainnet (chainId
// 8217; deployInfo/exercise-supplement-setup-kaia.json), registered as admins on the
// ExerciseSupplementNFT proxy -- but had zero test coverage. Both files declare the SAME
// contract name (ExerciseSupplementNFTSpecial, see CHALLENGE-2709), so this file drives both
// deployed FQNs through identical smoke + access-control coverage.
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers } = hre as any;

const VARIANTS = [
  {
    label: 'ExerciseSupplementNFTSpecial1',
    fqn: 'contracts/ExerciseSupplementNFTSpecial1/ExerciseSupplementNFTSpecial1.sol:ExerciseSupplementNFTSpecial',
  },
  {
    label: 'ExerciseSupplementNFTSpecial2',
    fqn: 'contracts/ExerciseSupplementNFTSpecial1/ExerciseSupplementNFTSpecial2.sol:ExerciseSupplementNFTSpecial',
  },
];

for (const variant of VARIANTS) {
  describe(`CHALLENGE-2737: ${variant.label} smoke + access control`, function () {
    async function deployFixture() {
      const [owner, admin2, recipient, outsider] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory(variant.fqn);
      const nft = await Factory.deploy('ipfs://base/');
      await nft.waitForDeployment();
      return { nft, owner, admin2, recipient, outsider };
    }

    it('deploys with the configured baseURI and the deployer as the sole initial admin', async function () {
      const { nft, owner } = await deployFixture();
      expect(await nft.baseURI()).to.equal('ipfs://base/');
      expect(await nft.getAdmins()).to.deep.equal([owner.address]);
    });

    it('deployer (an admin) can mint; nextTokenIdToMint/tokenURI/ownerOf reflect it', async function () {
      const { nft, owner, recipient } = await deployFixture();
      await nft.connect(owner).safeMint(recipient.address);
      expect(await nft.ownerOf(0)).to.equal(recipient.address);
      expect(await nft.nextTokenIdToMint()).to.equal(1n);
      expect(await nft.tokenURI(0)).to.equal('ipfs://base/0.json');
    });

    it('a non-admin cannot mint (access-control negative test)', async function () {
      const { nft, outsider, recipient } = await deployFixture();
      await expect(nft.connect(outsider).safeMint(recipient.address)).to.be.revertedWith(
        "Address can't mint NFT"
      );
    });

    it('updateAdmin(addr, true) by an existing admin grants mint rights to the new admin', async function () {
      const { nft, owner, admin2, recipient } = await deployFixture();
      await nft.connect(owner).updateAdmin(admin2.address, true);
      expect(await nft.getAdmins()).to.include(admin2.address);
      await expect(nft.connect(admin2).safeMint(recipient.address)).to.not.be.reverted;
    });

    it('updateAdmin(addr, false) revokes mint rights', async function () {
      const { nft, owner, admin2, recipient } = await deployFixture();
      await nft.connect(owner).updateAdmin(admin2.address, true);
      await nft.connect(owner).updateAdmin(admin2.address, false);
      expect(await nft.getAdmins()).to.not.include(admin2.address);
      await expect(nft.connect(admin2).safeMint(recipient.address)).to.be.revertedWith(
        "Address can't mint NFT"
      );
    });

    it('a non-admin cannot call updateAdmin (access-control negative test)', async function () {
      const { nft, outsider, admin2 } = await deployFixture();
      await expect(nft.connect(outsider).updateAdmin(admin2.address, true)).to.be.revertedWith(
        'NOT ADMIN'
      );
    });

    it('updateAdmin rejects the zero address', async function () {
      const { nft, owner } = await deployFixture();
      await expect(nft.connect(owner).updateAdmin(ethers.ZeroAddress, true)).to.be.revertedWith(
        'INVALID ADDRESS'
      );
    });

    it('owner can setBaseURI; a non-owner cannot (owner is separate from the admin set)', async function () {
      const { nft, owner, admin2 } = await deployFixture();
      // admin2 is granted admin rights but is NOT the owner -- setBaseURI is onlyOwner, not onlyAdmin.
      await nft.connect(owner).updateAdmin(admin2.address, true);
      await expect(nft.connect(admin2).setBaseURI('ipfs://new/')).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
      await expect(nft.connect(owner).setBaseURI('ipfs://new/')).to.not.be.reverted;
      expect(await nft.baseURI()).to.equal('ipfs://new/');
    });
  });
}
