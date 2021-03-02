// standard JS libs
const assert = require('assert');

// installed JS libs
const ganache = require('ganache-cli'); // local eth testnet, also TestRPC
const Web3 = require('web3'); // contructor for web3

// create ganache provider
const provider = ganache.provider();

// create a web3 instance on local ganache testnet
const web3 = new Web3(provider);

// grab ABI and bytecode from compiled contract
const { interface, bytecode } = require('../compile');

// initialize accounts and inbox variables
let accounts;
let lottery;

// mocha.beforeEach() runs before each mocha.it() test
// it is best practice to initalize a new contract for each test
beforeEach(async () => {

  // ganache generates several unlocked accounts,
  // use the first one to deploy contract
  accounts = await web3.eth.getAccounts()

  // contruct the contract from JSON-ABI, deploy to ganache
  lottery = await new web3.eth.Contract(JSON.parse(interface))
    .deploy({ data: bytecode })
    .send({ from: accounts[0], gas: '1000000' });
  lottery.setProvider(provider);

});

// mocha.it() runs a test and makes an assertion
// mocha.describe() groups several tests together
// three functionality tests are preformed below
describe('Lottery Tests', () => {

  it('deploys a contract', () => {
    assert.ok(lottery.options.address);
  }); // test 1

  it('one account can enter', async () => {

    // enter one player into lottery
    await lottery.methods.enter()
      .send({
        from: accounts[0],
        value: web3.utils.toWei('0.02', 'ether')
      });

    // get list of players
    const players = await lottery.methods.getPlayers()
      .call({ from: accounts[0] });

    // check that the account was added to players
    // and that there is only one player
    assert.equal(accounts[0], players[0]);
    assert.equal(1, players.length); // should be one

  }); // test 2

    it('multiple accounts can enter', async () => {

      // enter 3 players into lottery
      await lottery.methods.enter().send({
          from: accounts[0],
          value: web3.utils.toWei('0.02', 'ether')
        });
      await lottery.methods.enter().send({
          from: accounts[1],
          value: web3.utils.toWei('0.02', 'ether')
        });
      await lottery.methods.enter().send({
          from: accounts[2],
          value: web3.utils.toWei('0.02', 'ether')
        });

      // get list of players
      const players = await lottery.methods.getPlayers()
        .call({ from: accounts[0] });

      // check that all players were entered
      assert.equal(accounts[0], players[0]);
      assert.equal(accounts[1], players[1]);
      assert.equal(accounts[2], players[2]);
      assert.equal(3, players.length);

    }); // test 3

    it('rejects entries below minimum ether requirement', async () => {

      // test fails if transaction has less than minimum ether
      try{
        await lottery.methods.enter()
          .send({ from: accounts[0], value: 0 });
        assert(false);
      } catch (err) {
        assert(err);
      }

    }); // test 4

    it('only manager can pick winner', async () => {

      // test fails if non-manager is allowed to call pickWinner()
      try {
        await lottery.methods.pickWinner().send({ from: accounts[1] });
      } catch (err) {
        assert(err);
      }

    }); // test 5

    it('sends money to winner and resets players', async () => {

      // test only enters one player, so that the winner is deterministic
      await lottery.methods.enter().send({
          from: accounts[1],
          value: web3.utils.toWei('1', 'ether')
        });

      // check account balance of winner before and after lottery is drawn
      const preBalance = await web3.eth.getBalance(accounts[1]);
      await lottery.methods.pickWinner().send({ from: accounts[0] });
      const postBalance = await web3.eth.getBalance(accounts[1])

      // winner should gain 1 eth
      // but that is not exact, due to gas fees
      difference = postBalance - preBalance;
      assert(difference > web3.utils.toWei('0.8', 'ether'))

      // check that players is resets
      const players = await lottery.methods.getPlayers()
        .call({ from: accounts[0] });
      assert.equal(0,players);

      // check that lottery balance is reset
      const prizePool = await web3.eth.getBalance(lottery.options.address)
      assert.equal(0,prizePool);

    }); // test 6

}); // end of tests
