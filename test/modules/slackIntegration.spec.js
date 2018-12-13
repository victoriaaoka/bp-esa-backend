import sinon from 'sinon';
import * as slack from '../../server/modules/slack/slackIntegration';
import client from '../../server/helpers/redis';
import { allocationsMocks, rawAllocations, onboardingAllocations } from '../mocks/allocations';
import slackMocks from '../mocks/slack';

const fakeClientGet = sinon
  .stub(client, 'get')
  .callsFake((value, cb) => cb.apply(this, [null, rawAllocations]));
const fakeLookupByEmail = sinon
  .stub(slack.slackClient.users, 'lookupByEmail')
  .callsFake(() => slackMocks.slackUser);
const fakeInvite = sinon
  .stub(slack.slackClient.groups, 'invite')
  .callsFake(() => slackMocks.inviteUser);
const fakeKick = sinon
  .stub(slack.slackClient.groups, 'kick')
  .callsFake(() => slackMocks.removeUser);

describe('Slack Integration Test Suite', async () => {
  it('Should create internal slack channels for a new partner', async () => {
    const fakeCreate = sinon
      .stub(slack.slackClient.groups, 'create')
      .callsFake(() => slackMocks.createGroups.createInternal);
    const { data } = onboardingAllocations;
    const { client_name: partnerName } = data.values[0];
    const createResult = await slack.createPartnerChannel(partnerName, 'internal');
    const expectedResult = {
      partnerId: 'ABCDEFZYXWVU',
      internalChannel: {
        id: 'GEY7RDC5V',
        name: 'p-sample-partner-int',
      },
    };
    expect(createResult.internalChannel.id).to.equal(expectedResult.internalChannel.id);
    expect(createResult.internalChannel.name).to.equal(expectedResult.internalChannel.name);
    fakeCreate.restore();
  });
  it('Should create general slack channels for a new partner', async () => {
    const fakeCreate = sinon
      .stub(slack.slackClient.groups, 'create')
      .callsFake(() => slackMocks.createGroups.createGeneral);
    const { data } = onboardingAllocations;
    const { client_name: partnerName } = data.values[0];
    const createResult = await slack.createPartnerChannel(partnerName, 'general');
    const expectedResult = {
      partnerId: 'ABCDEFZYXWVU',
      generalChannel: {
        id: 'GDL7RDC5V',
        name: 'p-sample-partner',
      },
    };
    expect(createResult.generalChannel.id).to.equal(expectedResult.generalChannel.id);
    expect(createResult.generalChannel.name).to.equal(expectedResult.generalChannel.name);
    fakeCreate.restore();
  });
  it('Should add developers to respective channels', async () => {
    const email = 'johndoe@mail.com';
    const channel = 'GDL7RDC5V';
    const inviteResult = await slack.accessChannel(email, channel, 'invite');
    expect(inviteResult.message).to.equal('User added to channel successfully');
    fakeInvite.restore();
  });
  it('Should remove developers from channels', async () => {
    const email = 'johndoe@mail.com';
    const channel = 'GDL7RDC5V';
    const inviteResult = await slack.accessChannel(email, channel, 'kick');
    expect(inviteResult.message).to.equal('User removed from channel successfully');
    fakeKick.restore();
  });
  it('addOrRemove method should return error when response status is false', async () => {
    const failedInvite = 'Error: Could not add user to channel';
    const fakeFailedInvite = sinon.stub(slack.slackClient.groups, 'invite').callsFake(() => ({
      ok: false,
    }));
    try {
      await slack.accessChannel('anaeze@andela.com', 'lagos-all', 'invite');
    } catch (error) {
      expect(error.message).to.equal(failedInvite);
    }
    fakeFailedInvite.restore();
  });
});
