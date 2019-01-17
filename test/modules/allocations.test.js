import sinon from 'sinon';
import axios from 'axios';
import client from '../../server/helpers/redis';
import * as resource from '../../server/modules/allocations';
import onboardingAllocations from '../mocks/allocations';
import { stringifiedPartners, samplePartner } from '../mocks/partners';

describe('Partner and Allocations Test Suite', async () => {
  it('Should fetch new placements based on the status specified, and the numberOfDays provided', async () => {
    // Mock successful request
    const fakeAxiosGet = sinon.stub(axios, 'get').callsFake(
      () => new Promise((resolve) => {
        resolve(onboardingAllocations);
      }),
    );
    // Mock current date and set to static value of the date test was written: 2018-11-16
    // To prevent failing tests in future due to change in value of Date.now
    // being called within the function
    const fakeCurrentDate = sinon.stub(Date, 'now').callsFake(() => 1542376484108);

    const result = await resource.fetchNewPlacements('Placed - Awaiting Onboarding', 3);
    // In mock data, there are two records for each created_at date from 2018-11-13 to 2018-11-16
    const last3days = Date.parse('2018-11-13');
    expect(result.every(item => Date.parse(item.created_at) >= last3days)).to.equal(true);
    expect(result.length).to.equal(6);
    // Total onboarding.data.values objects in mock response is 10
    expect(onboardingAllocations.data.values.length - result.length).to.equal(4);
    fakeAxiosGet.restore();
    fakeCurrentDate.restore();
  });
  it('Should successfully fetch partner when partnerId is provided', async () => {
    // Mock successful request
    const fakeAxiosGet = sinon.stub(axios, 'get').callsFake(
      () => new Promise((resolve) => {
        resolve(samplePartner);
      }),
    );
    // const fakeClientGet = sinon
    //   .stub(client, 'get')
    //   .callsFake((value, cb) => cb.apply(this, [null, stringifiedPartners]));
    const fakeClientSet = sinon.stub(client, 'set').callsFake(() => undefined);

    const partner = await resource.findPartnerById('ABCDEFZYXWVU');
    expect(partner.id).to.equal('ABCDEFZYXWVU');

    fakeAxiosGet.restore();
    // fakeClientGet.restore();
    fakeClientSet.restore();
  });
});
